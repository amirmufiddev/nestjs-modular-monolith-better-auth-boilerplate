// Mock express untuk testing karena Better Auth adapter check express
export default {
  Router: jest.fn(),
  json: jest.fn(),
  urlencoded: jest.fn(),
};

export const Router = jest.fn();
export const json = jest.fn();
export const urlencoded = jest.fn();
