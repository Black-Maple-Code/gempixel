import { render } from 'preact';
import { App } from './App';
import '@fontsource-variable/newsreader/wght.css'; // 'Newsreader Variable', wght 200–800
import '@fontsource-variable/archivo/wght.css'; // 'Archivo Variable', wght 100–900
import '@fontsource/jetbrains-mono/400.css'; // 'JetBrains Mono' 400
import '@fontsource/jetbrains-mono/700.css'; // 'JetBrains Mono' 700 (DMC/bag emphasis)
import './index.css';

const container = document.getElementById('app');
if (container) {
  render(<App />, container);
}
