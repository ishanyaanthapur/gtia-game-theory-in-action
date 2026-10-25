import itertools

import pytest

from backend.game.coverage import allowed_partner_moves, locked_player_moves
from backend.game.engine import MAX_CELL_ATTEMPTS, GameError, GameSession
from backend.game.payoffs import ALL_CELLS, PAYOFFS, Move
from backend.models import Avatar, Phase

S, C = Move.SILENT, Move.CONFESS


def play(session: GameSession, player: Move, partner: Move | None = None) -> None:
    allowed = session.allowed_partner_moves(player)
    session.resolve_round(player, partner or allowed[0])
    r = session.current
    assert session.answer_cell(r.player_years, r.partner_years) == (True, False)


def test_payoffs_match_the_story():
    assert PAYOFFS[(S, S)] == (1, 1)
    assert PAYOFFS[(C, S)] == (0, 3)
    assert PAYOFFS[(S, C)] == (3, 0)
    assert PAYOFFS[(C, C)] == (2, 2)


def test_partner_is_free_when_both_cells_in_row_are_open():
    assert allowed_partner_moves(S, []) == [S, C]


def test_partner_is_forced_into_the_remaining_open_cell():
    assert allowed_partner_moves(S, [(S, S)]) == [C]
    assert allowed_partner_moves(C, [(C, C)]) == [S]


def test_full_row_locks_that_player_move():
    assert locked_player_moves([(S, S), (S, C)]) == [S]
    assert locked_player_moves([(S, S), (C, C)]) == []


@pytest.mark.parametrize("partner_picks", list(itertools.product([0, 1], repeat=4)))
@pytest.mark.parametrize("player_prefers", [S, C])
def test_every_legal_playthrough_covers_all_four_cells_in_four_rounds(partner_picks, player_prefers):
    """Stubborn player (always tries the same move until locked) + any partner choice → 4 cells."""
    session = GameSession(avatar=Avatar.KIMCHI)
    for pick in partner_picks:
        if session.phase == Phase.CHALLENGE:
            break
        move = player_prefers if player_prefers not in session.locked_moves() else next(
            m for m in Move if m != player_prefers
        )
        allowed = session.allowed_partner_moves(move)
        play(session, move, allowed[pick % len(allowed)])
    assert session.phase == Phase.CHALLENGE
    assert set(session.visited) == set(ALL_CELLS)
    assert len(session.history) == 4


def test_locked_move_is_rejected():
    session = GameSession(avatar=Avatar.YOSHI)
    play(session, S, S)
    play(session, S, C)
    with pytest.raises(GameError) as err:
        session.validate_player_move(S)
    assert err.value.status == 422


def test_cannot_play_a_move_while_filling_the_matrix():
    session = GameSession(avatar=Avatar.YOSHI)
    session.resolve_round(S, S)
    with pytest.raises(GameError):
        session.resolve_round(C, S)


def test_cannot_play_after_game_complete():
    session = GameSession(avatar=Avatar.JUJUBEE)
    for move in (S, S, C, C):
        play(session, move)
    assert session.phase == Phase.CHALLENGE
    with pytest.raises(GameError):
        session.validate_player_move(C)


def test_disallowed_partner_move_is_rejected_by_engine():
    session = GameSession(avatar=Avatar.JUJUBEE)
    play(session, S, S)
    with pytest.raises(GameError):
        session.resolve_round(S, S)  # (S,S) already visited; only C is allowed


def test_wrong_answers_then_reveal():
    session = GameSession(avatar=Avatar.JUJUBEE)
    session.resolve_round(C, S)  # correct answer is (0, 3)
    for _ in range(MAX_CELL_ATTEMPTS - 1):
        assert session.answer_cell(3, 0) == (False, False)
        assert session.phase == Phase.MATRIX
    assert session.answer_cell(3, 0) == (False, True)
    assert session.phase == Phase.INTERROGATION
    assert session.view().matrix[2].revealed  # (C, S) cell now shown


def test_matrix_hides_unanswered_cells():
    session = GameSession(avatar=Avatar.JUJUBEE)
    session.resolve_round(S, S)
    assert not any(c.revealed for c in session.view().matrix)


def finished_matrix() -> GameSession:
    session = GameSession(avatar=Avatar.KIMCHI)
    for move in (S, S, C, C):
        play(session, move)
    return session


def test_matrix_complete_leads_to_dominant_strategy_challenge():
    session = finished_matrix()
    assert session.phase == Phase.CHALLENGE
    with pytest.raises(GameError):
        session.answer_cell(1, 1)  # matrix is done


def test_naming_confess_as_dominant_completes_the_game():
    session = finished_matrix()
    assert session.answer_dominant(C) == (True, False)
    assert session.phase == Phase.COMPLETE and session.dominant_found is True


def test_two_wrong_picks_reveal_the_answer():
    session = finished_matrix()
    assert session.answer_dominant(S) == (False, False)
    assert session.phase == Phase.CHALLENGE
    assert session.answer_dominant(S) == (False, True)
    assert session.phase == Phase.COMPLETE and session.dominant_found is False


def test_tutor_questions_are_capped_and_only_during_challenge():
    from backend.game.engine import MAX_TUTOR_QUESTIONS

    early = GameSession(avatar=Avatar.KIMCHI)
    with pytest.raises(GameError):
        early.register_tutor_question()
    session = finished_matrix()
    for _ in range(MAX_TUTOR_QUESTIONS):
        session.register_tutor_question()
    with pytest.raises(GameError) as err:
        session.register_tutor_question()
    assert err.value.status == 429
