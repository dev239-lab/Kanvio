import { useState } from 'react';
import Card from './Card';

const DOTS = ['#94a3b8', '#4f46e5', '#16a34a', '#db2777', '#0d9488', '#d97706'];

export default function List({
  list,
  index,
  members,
  onAddCard,
  onDeleteCard,
  onDropCard,
  onOpenCard,
}) {
  const [title, setTitle] = useState('');
  const [over, setOver] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onAddCard(list._id, title);
    setTitle('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setOver(false);
    onDropCard(e, list._id, list.cards.length); // dropped on empty space = end of list
  };

  return (
    <div
      className={`k-list${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      }}
      onDrop={handleDrop}
    >
      <div className="k-list-head">
        <span className="k-list-title">
          <span className="list-dot" style={{ background: DOTS[index % DOTS.length] }} />
          {list.title}
        </span>
        <span className="count-pill">{list.cards.length}</span>
      </div>

      {list.cards.map((card, i) => (
        <Card
          key={card._id}
          card={card}
          listId={list._id}
          index={i}
          members={members}
          onDelete={(cardId) => onDeleteCard(list._id, cardId)}
          onDropCard={(...args) => {
            setOver(false);
            onDropCard(...args);
          }}
          onOpen={onOpenCard}
        />
      ))}

      <form onSubmit={handleSubmit}>
        <input
          className="add-card-input"
          placeholder="+ Add a card"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </form>
    </div>
  );
}