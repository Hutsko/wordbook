import '@testing-library/jest-dom';

// Mock global fetch for Node environment
(global as any).fetch = jest.fn(() =>
  Promise.resolve({
    arrayBuffer: async () => new ArrayBuffer(8),
  })
) as any;
