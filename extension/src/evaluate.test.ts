import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluationExpression, reportedFailure, textFromEvaluation } from './evaluate.ts'

test('wraps code so return and await run in the page', () => {
  assert.equal(evaluationExpression('return 1 + 2'), '(async () => {\nreturn 1 + 2\n})()')
})

test('serializes a return value as JSON text', () => {
  assert.equal(textFromEvaluation({ result: { type: 'number', value: 3 } }), '3')
  assert.equal(textFromEvaluation({ result: { type: 'string', value: 'Todo' } }), 'Todo')
  assert.equal(textFromEvaluation({ result: { type: 'object', value: { ok: true } } }), '{"ok":true}')
})

test('reports a thrown error with its message and stack', () => {
  const error = (() => {
    try {
      textFromEvaluation({
        exceptionDetails: {
          text: 'Uncaught (in promise)',
          exception: { description: 'Error: x\n    at <anonymous> (https://3.basecamp.com/todo:2:9)' },
          stackTrace: {
            callFrames: [{ functionName: '', url: 'https://3.basecamp.com/todo', lineNumber: 1, columnNumber: 8 }],
          },
        },
      })
      return null
    } catch (caught) {
      return caught
    }
  })()
  const text = reportedFailure(error)
  assert.match(text, /Error: x/)
  assert.match(text, /basecamp\.com/)
})
