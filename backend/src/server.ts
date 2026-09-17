import app from './app.js';
import { port } from './config/index.js';

app.listen(port, () => {
  console.log(`KrishiSetu backend listening on http://localhost:${port}`);
});
