import { QuartzTransformerPlugin } from '@quartz-community/types';

interface DataviewJSOptions {
    /**
     * Milliseconds after which a `requestUrl()` call made by a script is
     * aborted, so a slow server cannot hang the build. `0` disables the limit.
     */
    requestTimeout?: number;
}
declare const DataviewJS: QuartzTransformerPlugin<DataviewJSOptions>;

export { DataviewJS, type DataviewJSOptions };
