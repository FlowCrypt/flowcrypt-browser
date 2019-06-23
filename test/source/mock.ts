
import { startGoogleApiMock } from './mock/google-api-mock';

startGoogleApiMock().catch(e => {
  console.error(e);
  process.exit(1);
});
