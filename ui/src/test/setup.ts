// Vitest + jsdom setup. Marks the environment as a React act() environment so
// state updates are flushed deterministically in tests.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
