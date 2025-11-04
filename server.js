import app from './src/app.js';
import config from './src/config/index.js';

const PORT = config.port || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});