import { useEffect, useState } from 'react';
import api from '../services/api';
import List from './List';
import useSocket from '../hooks/useSocket';
import CommentBox from './CommentBox';
import ConfirmDialog from './ConfirmDialog';
import { newCardPosition, confirmDeleteEnabled, assignToMeEnabled } from '../utils/preferences';

// Puts a new card at the top of a list when it has position 0, otherwise at the bottom
function withCard(cards, card) {
  return card.position === 0 && cards.length > 0 ? [card, ...cards] : [...cards, card];
}

export default function Board({ boardId, lists, setLists, members }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [openCardId, setOpenCardId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // card waiting for confirmation
  const socket = useSocket();

  // Always read the open card from the lists, so live changes show inside the panel
  const openCard = openCardId
    ? lists.flatMap((l) => l.cards).find((c) => c._id === openCardId)
    : null;
  const openList = openCard ? lists.find((l) => l._id === openCard.list) : null;

  useEffect(() => {
    if (!socket) return;

    const join = () => socket.emit('joinBoard', boardId);
    if (socket.connected) join();
    socket.on('connect', join); // re-join after a reconnect

    const onListCreated = (list) =>
      setLists((prev) =>
        prev.some((l) => l._id === list._id) ? prev : [...prev, { ...list, cards: [] }]
      );

    const onCardCreated = (card) =>
      setLists((prev) =>
        prev.map((l) =>
          l._id === card.list && !l.cards.some((c) => c._id === card._id)
            ? { ...l, cards: withCard(l.cards, { ...card, commentCount: 0 }) }
            : l
        )
      );

    // Keep the comment count when a card's other fields change
    const onCardUpdated = (card) =>
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) =>
            c._id === card._id ? { ...card, commentCount: c.commentCount } : c
          ),
        }))
      );

    const onCardDeleted = ({ cardId }) =>
      setLists((prev) =>
        prev.map((l) => ({ ...l, cards: l.cards.filter((c) => c._id !== cardId) }))
      );

    // Moving shifts other cards' positions, so reload the board for accuracy
    const onCardMoved = () => {
      api.get(`/boards/${boardId}`).then(({ data }) => setLists(data.lists));
    };

    const changeCount = (cardId, delta) =>
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) =>
            c._id === cardId
              ? { ...c, commentCount: Math.max(0, (c.commentCount || 0) + delta) }
              : c
          ),
        }))
      );

    const onCommentAdded = (comment) => changeCount(comment.card, 1);
    const onCommentDeleted = ({ cardId }) => changeCount(cardId, -1);

    socket.on('listCreated', onListCreated);
    socket.on('cardCreated', onCardCreated);
    socket.on('cardUpdated', onCardUpdated);
    socket.on('cardDeleted', onCardDeleted);
    socket.on('cardMoved', onCardMoved);
    socket.on('commentAdded', onCommentAdded);
    socket.on('commentDeleted', onCommentDeleted);

    return () => {
      socket.emit('leaveBoard', boardId);
      socket.off('connect', join);
      socket.off('listCreated', onListCreated);
      socket.off('cardCreated', onCardCreated);
      socket.off('cardUpdated', onCardUpdated);
      socket.off('cardDeleted', onCardDeleted);
      socket.off('cardMoved', onCardMoved);
      socket.off('commentAdded', onCommentAdded);
      socket.off('commentDeleted', onCommentDeleted);
    };
  }, [socket, boardId, setLists]);

  const addList = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const { data } = await api.post(`/boards/${boardId}/lists`, { title });
      setLists((prev) =>
        prev.some((l) => l._id === data._id) ? prev : [...prev, { ...data, cards: [] }]
      );
      setTitle('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add list');
    }
  };

  const addCard = async (listId, cardTitle) => {
    try {
      const { data } = await api.post('/cards', {
        title: cardTitle,
        listId,
        atTop: newCardPosition() === 'top',
        assignToMe: assignToMeEnabled(),
      });
      setLists((prev) =>
        prev.map((l) =>
          l._id === listId && !l.cards.some((c) => c._id === data._id)
            ? { ...l, cards: withCard(l.cards, { ...data, commentCount: 0 }) }
            : l
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add card');
    }
  };

  // Used by the card panel. It throws on failure so the panel can show the error.
  const updateCard = async (cardId, fields) => {
    const { data } = await api.put(`/cards/${cardId}`, fields);
    setLists((prev) =>
      prev.map((l) => ({
        ...l,
        cards: l.cards.map((c) =>
          c._id === cardId ? { ...data, commentCount: c.commentCount } : c
        ),
      }))
    );
  };

  const deleteCard = async (listId, cardId) => {
    try {
      await api.delete(`/cards/${cardId}`);
      setLists((prev) =>
        prev.map((l) =>
          l._id === listId ? { ...l, cards: l.cards.filter((c) => c._id !== cardId) } : l
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete card');
    }
  };

  // Asks first (when turned on in Settings), then deletes
  const requestDelete = (listId, cardId) => {
    if (!confirmDeleteEnabled()) {
      deleteCard(listId, cardId);
      return;
    }
    const card = lists.find((l) => l._id === listId)?.cards.find((c) => c._id === cardId);
    setPendingDelete({ listId, cardId, title: card?.title || 'this card' });
  };

  const moveCard = async (e, targetListId, targetIndex) => {
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const { cardId, fromListId } = payload;

    const previous = lists; // saved so we can undo if the server says no
    const source = lists.find((l) => l._id === fromListId);
    const card = source?.cards.find((c) => c._id === cardId);
    if (!card) return;

    const fromIndex = source.cards.findIndex((c) => c._id === cardId);
    let toIndex = targetIndex;
    if (fromListId === targetListId && fromIndex < toIndex) toIndex -= 1;
    if (fromListId === targetListId && fromIndex === toIndex) return;

    // Update the screen immediately
    setLists((prev) => {
      const removed = prev.map((l) =>
        l._id === fromListId ? { ...l, cards: l.cards.filter((c) => c._id !== cardId) } : l
      );
      return removed.map((l) => {
        if (l._id !== targetListId) return l;
        const cards = [...l.cards];
        cards.splice(toIndex, 0, { ...card, list: targetListId });
        return { ...l, cards };
      });
    });

    // Then save it
    try {
      await api.put(`/cards/${cardId}/move`, { listId: targetListId, position: toIndex });
    } catch (err) {
      setLists(previous);
      setError(err.response?.data?.message || 'Could not move card');
    }
  };

  return (
    <div>
      {error && <p className="form-error">{error}</p>}
      <div className="lists-wrap">
        {lists.map((list, i) => (
          <List
            key={list._id}
            list={list}
            index={i}
            members={members}
            onAddCard={addCard}
            onDeleteCard={requestDelete}
            onDropCard={moveCard}
            onOpenCard={(card) => setOpenCardId(card._id)}
          />
        ))}

        <form className="add-list" onSubmit={addList}>
          <input
            placeholder="+ Add another list"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </form>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this card?"
          message={`"${pendingDelete.title}" and its comments will be removed for everyone on the board.`}
          confirmLabel="Delete card"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteCard(pendingDelete.listId, pendingDelete.cardId);
            setPendingDelete(null);
          }}
        />
      )}

      {openCard && (
        <CommentBox
          key={openCard._id}
          card={openCard}
          listTitle={openList?.title}
          members={members || []}
          onClose={() => setOpenCardId(null)}
          onUpdate={updateCard}
        />
      )}
    </div>
  );
}