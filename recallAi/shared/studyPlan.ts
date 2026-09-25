import { z } from 'zod';

const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);

const distinctText = (values: string[]) =>
  new Set(values.map((value) => value.toLocaleLowerCase())).size === values.length;

const conceptsSchema = z.array(text(160)).min(3).max(8).refine(distinctText, {
  message: 'Concepts must be distinct.',
});

const optionsSchema = z.tuple([text(180), text(180), text(180), text(180)]).refine(distinctText, {
  message: 'Quiz options must be distinct.',
});

const flashcardContentSchema = z.strictObject({
  question: text(300),
  answer: text(600),
});

const quizContentSchema = z.strictObject({
  question: text(300),
  options: optionsSchema,
  correctOptionIndex: z.number().int().min(0).max(3),
  explanation: text(400),
});

const contentShape = {
  title: text(100),
  summary: text(600),
  concepts: conceptsSchema,
  flashcards: z.array(flashcardContentSchema).min(3).max(8),
  quiz: z.array(quizContentSchema).min(3).max(6),
};

export const studyPlanContentSchema = z.strictObject(contentShape);

const flashcardSchema = flashcardContentSchema.safeExtend({
  id: z.string().regex(/^fc-[1-9]\d*$/),
});

const quizQuestionSchema = quizContentSchema.safeExtend({
  id: z.string().regex(/^q-[1-9]\d*$/),
});

export const studyPlanSchema = z.strictObject({
  ...contentShape,
  flashcards: z.array(flashcardSchema).min(3).max(8),
  quiz: z.array(quizQuestionSchema).min(3).max(6),
}).refine((plan) => new Set(plan.flashcards.map((card) => card.id)).size === plan.flashcards.length, {
  message: 'Flashcard IDs must be unique.',
}).refine((plan) => new Set(plan.quiz.map((question) => question.id)).size === plan.quiz.length, {
  message: 'Quiz IDs must be unique.',
});

export type StudyPlanContent = z.infer<typeof studyPlanContentSchema>;
export type StudyPlan = z.infer<typeof studyPlanSchema>;

export function validateStudySemantics(content: StudyPlanContent): boolean {
  const distinctQuestions = (questions: string[]) => distinctText(questions);
  return (
    distinctQuestions(content.flashcards.map((card) => card.question)) &&
    distinctQuestions(content.quiz.map((question) => question.question)) &&
    content.quiz.every((question) => {
      const selectedOption = question.options[question.correctOptionIndex];
      const expectedOpening = `Correct answer: ${selectedOption}.`;
      return question.explanation.toLocaleLowerCase().startsWith(expectedOpening.toLocaleLowerCase()) &&
        question.explanation.length > expectedOpening.length;
    })
  );
}

export function assignStudyPlanIds(content: StudyPlanContent): StudyPlan {
  return studyPlanSchema.parse({
    ...content,
    flashcards: content.flashcards.map((card, index) => ({ ...card, id: `fc-${index + 1}` })),
    quiz: content.quiz.map((question, index) => ({ ...question, id: `q-${index + 1}` })),
  });
}
