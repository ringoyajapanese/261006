// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import App from './App';
import { situations } from './data';
afterEach(cleanup);
it('shows the exact 12 sentences with aligned readings, translations and bounded navigation', () => {
  expect(situations).toHaveLength(4); expect(situations.flatMap(s => s.sentences)).toHaveLength(12);
  expect(new Set(situations.flatMap(s => [s.id, ...s.sentences.map(x => x.id)])).size).toBe(16);
  render(<App/>);
  for (const situation of situations) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(situation.name) }));
    expect((screen.getByRole('button', { name: '이전 문장' }) as HTMLButtonElement).disabled).toBe(true);
    situation.sentences.forEach((sentence, index) => {
      expect(screen.getByText(sentence.japanese).lang).toBe('ja'); expect(screen.getByText(sentence.reading).lang).toBe('ja');
      expect(screen.getByText(sentence.meaning)).toBeTruthy(); expect(screen.getByLabelText(`현재 문장 ${index + 1}, 전체 3`)).toBeTruthy();
      if (index < 2) fireEvent.click(screen.getByRole('button', { name: '다음 문장' }));
    });
    expect((screen.getByRole('button', { name: '다음 문장' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '이전 문장' })); expect(screen.getByText(situation.sentences[1].japanese)).toBeTruthy();
  }
});
