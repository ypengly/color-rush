import type { Participant } from '../types/game';
import {
  MAX_NAME_LENGTH,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  ValidationResult,
} from '../game/participants';
import { BallPreview } from './BallPreview';

interface Props {
  participants: Participant[];
  validation: ValidationResult;
  disabled: boolean;
  onChangeName: (id: string, name: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRestoreDefaults: () => void;
}

export function ParticipantEditor({
  participants,
  validation,
  disabled,
  onChangeName,
  onChangeColor,
  onAdd,
  onRemove,
  onRestoreDefaults,
}: Props) {
  return (
    <section className="panel editor" aria-label="Participants">
      <div className="panel-head">
        <h2 className="panel-title">
          Participants{' '}
          <span className="count">
            {participants.length}/{MAX_PARTICIPANTS}
          </span>
        </h2>
      </div>

      {disabled && <p className="muted small">Press RESTART to edit the lineup.</p>}

      {validation.global.map((msg) => (
        <p key={msg} className="error" role="alert">
          {msg}
        </p>
      ))}

      <ul className="participants">
        {participants.map((p, i) => {
          const errors = validation.byId[p.id] ?? [];
          return (
            <li key={p.id} className={`participant${errors.length ? ' invalid' : ''}`}>
              <BallPreview color={/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888888'} />
              <div className="participant-fields">
                <input
                  className="name-input"
                  type="text"
                  value={p.name}
                  maxLength={MAX_NAME_LENGTH + 10}
                  onChange={(e) => onChangeName(p.id, e.target.value)}
                  disabled={disabled}
                  aria-label={`Name for participant ${i + 1}`}
                  aria-invalid={errors.length > 0}
                  placeholder="Name"
                />
                {errors.map((msg) => (
                  <span key={msg} className="error small" role="alert">
                    {msg}
                  </span>
                ))}
              </div>
              <input
                className="color-input"
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888888'}
                onChange={(e) => onChangeColor(p.id, e.target.value)}
                disabled={disabled}
                aria-label={`Color for ${p.name || `participant ${i + 1}`}`}
              />
              <button
                className="icon-btn"
                onClick={() => onRemove(p.id)}
                disabled={disabled || participants.length <= MIN_PARTICIPANTS}
                aria-label={`Remove ${p.name || `participant ${i + 1}`}`}
                title={participants.length <= MIN_PARTICIPANTS ? `At least ${MIN_PARTICIPANTS} participants are required` : 'Remove'}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <div className="editor-actions">
        <button className="btn" onClick={onAdd} disabled={disabled || participants.length >= MAX_PARTICIPANTS}>
          + ADD PARTICIPANT
        </button>
        <button className="btn btn-ghost" onClick={onRestoreDefaults} disabled={disabled}>
          RESTORE DEFAULTS
        </button>
      </div>
    </section>
  );
}
