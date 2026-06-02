export type TileStatus = 'correct' | 'present' | 'absent' | 'empty' | 'active';

export function evaluateGuess(guess: string[], answer: string[]): TileStatus[] {
  const result: TileStatus[] = Array(5).fill('absent');
  const answerCopy = [...answer];
  const guessCopy = [...guess];

  // first pass: mark correct
  for (let i = 0; i < 5; i++) {
    if (guessCopy[i] === answerCopy[i]) {
      result[i] = 'correct';
      answerCopy[i] = '';
      guessCopy[i] = '';
    }
  }

  // second pass: mark present
  for (let i = 0; i < 5; i++) {
    if (guessCopy[i] === '') continue;
    const idx = answerCopy.indexOf(guessCopy[i]);
    if (idx !== -1) {
      result[i] = 'present';
      answerCopy[idx] = '';
    }
  }

  return result;
}
