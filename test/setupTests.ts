import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';

const element = document.createElement('div');
element.id = 'root';
document.body.appendChild(element);
