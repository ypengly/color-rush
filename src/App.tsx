import { useCallback, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { Leaderboard } from './components/Leaderboard';
import { ParticipantEditor } from './components/ParticipantEditor';
import { RaceArena } from './components/RaceArena';
import { RaceControls } from './components/RaceControls';
import { WinnerModal } from './components/WinnerModal';
import {
  addParticipant,
  createDefaultParticipants,
  removeParticipant,
  updateParticipant,
  validateParticipants,
} from './game/participants';
import { computeStats } from './game/results';
import { useRace } from './hooks/useRace';
import type { Participant } from './types/game';

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>(() => createDefaultParticipants());
  const validation = useMemo(() => validateParticipants(participants), [participants]);
  const race = useRace(participants, validation.valid);

  const editable = race.phase === 'setup';
  const stats = useMemo(() => (race.results ? computeStats(race.results) : null), [race.results]);

  const onChangeName = useCallback(
    (id: string, name: string) => setParticipants((list) => updateParticipant(list, id, { name })),
    [],
  );
  const onChangeColor = useCallback(
    (id: string, color: string) => setParticipants((list) => updateParticipant(list, id, { color })),
    [],
  );
  const onAdd = useCallback(() => setParticipants((list) => addParticipant(list)), []);
  const onRemove = useCallback((id: string) => setParticipants((list) => removeParticipant(list, id)), []);
  const onRestoreDefaults = useCallback(() => setParticipants(createDefaultParticipants()), []);

  return (
    <div className="app">
      <Header />
      <main className="layout">
        <section className="stage" aria-label="Race">
          <RaceArena
            phase={race.phase}
            countdown={race.countdown}
            leader={race.standings[0] ?? null}
            closeCall={race.closeCall}
            attachCanvas={race.attachCanvas}
            resize={race.resize}
          />
          <RaceControls
            phase={race.phase}
            canStart={validation.valid}
            speed={race.speed}
            soundOn={race.soundOn}
            onStart={race.startRace}
            onPause={race.togglePause}
            onRestart={race.restart}
            onToggleSound={race.toggleSound}
            onSpeed={race.setSpeed}
          />
          {!validation.valid && race.phase === 'setup' && (
            <p className="error" role="alert">
              Fix the highlighted participants to start the race.
            </p>
          )}
          <Leaderboard
            phase={race.phase}
            standings={race.standings}
            results={race.results}
            lastRace={race.lastRace}
          />
        </section>

        <aside className="sidebar">
          <ParticipantEditor
            participants={participants}
            validation={validation}
            disabled={!editable}
            onChangeName={onChangeName}
            onChangeColor={onChangeColor}
            onAdd={onAdd}
            onRemove={onRemove}
            onRestoreDefaults={onRestoreDefaults}
          />
        </aside>
      </main>

      <WinnerModal
        open={race.modalOpen}
        results={race.results}
        stats={stats}
        onRaceAgain={race.raceAgain}
        onClose={race.closeModal}
      />
    </div>
  );
}
