import { modelRegistry } from '@/domain/model-registry';

/**
 * Public capability catalog. It intentionally contains no credentials or
 * provider secrets; paid submission still happens through server adapters.
 */
export async function GET() {
  return Response.json({
    schemaVersion: '1.0',
    models: modelRegistry,
  }, { headers: { 'cache-control': 'no-store' } });
}
