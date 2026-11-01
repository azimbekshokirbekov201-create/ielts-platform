"use client";
import type { Question } from "@/types";
import { Badge } from "@/components/ui/primitives";
export function QuestionCard({
  question,
  index,
  value,
  onChange,
  review = false,
}: {
  question: Question;
  index: number;
  value: string;
  onChange: (value: string) => void;
  review?: boolean;
}) {
  return (
    <fieldset className="question-card" id={`question-${question.id}`}>
      <legend>
        <span className="question-number">{index + 1}</span>
        <Badge color="slate">{question.type}</Badge>
      </legend>
      <label htmlFor={question.id}>{question.text}</label>
      {question.options ? (
        <div className="answer-options">
          {question.options.map((option) => (
            <label
              className={`answer-option ${value === option ? "selected" : ""}`}
              key={option}
            >
              <input
                disabled={review}
                type="radio"
                name={question.id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
        </div>
      ) : (
        <input
          className="input"
          id={question.id}
          placeholder="Type your answer…"
          value={value}
          disabled={review}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </fieldset>
  );
}
