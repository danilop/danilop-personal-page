declare module "*?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
declare module "*?raw" {
  const source: string;
  export default source;
}
