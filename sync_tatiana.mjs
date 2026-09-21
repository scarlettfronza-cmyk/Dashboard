import { syncMondayBoard } from './server/mondaySync.ts';

console.log('Sincronizando Dra Tatiana (clientId=60001, boardId=18406678106)...');
try {
  const result = await syncMondayBoard(60001, '18406678106');
  console.log('Resultado:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Erro:', err.message);
}
