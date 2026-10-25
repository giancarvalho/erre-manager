import { ThemeProvider } from '@erre/ui';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Home from '../src/app/index';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

test('home renders inside the providers', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <Home />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('header')).toHaveTextContent('Em construção');
});
