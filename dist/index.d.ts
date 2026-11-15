import { QuartzTransformerPlugin } from '@quartz-community/types';

interface DataviewJSOptions extends Record<string, unknown> {
}
declare const DataviewJS: QuartzTransformerPlugin<DataviewJSOptions>;

export { DataviewJS, type DataviewJSOptions };
