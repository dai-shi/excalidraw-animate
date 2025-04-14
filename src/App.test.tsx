import { render } from '@testing-library/react';
import App from './App';

// @ts-expect-error no types
test('renders without errros', () => {
  render(<App />);
});
