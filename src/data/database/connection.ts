/** Internal SQL boundary. Only the Expo adapter and SQLite integration tests implement this. */
export type SqlValue = string | number | null;
export interface SqlConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, parameters?: readonly SqlValue[]): Promise<void>;
  all(sql: string, parameters?: readonly SqlValue[]): Promise<readonly unknown[]>;
  close(): Promise<void>;
}

/** Own one private connection. Every operation (including reads and close) joins this queue. */
export function createTransactions(connection: SqlConnection) {
  let queue: Promise<unknown> = Promise.resolve();
  let closing = false;
  let unusable = false;
  let closeResult: Promise<void> | undefined;

  function transaction<T>(work: (sql: SqlConnection) => Promise<T>): Promise<T> {
    if (closing) return Promise.reject(new Error('Meditation database is closed'));
    const operation = queue.then(async () => {
      if (unusable) throw new Error('Meditation database requires reopening after failed rollback');
      // Obtain the writer lock BEFORE reading the checkpoint, including across connections.
      await connection.exec('BEGIN IMMEDIATE');
      try {
        const result = await work(connection);
        await connection.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          await connection.exec('ROLLBACK');
        } catch (rollbackError) {
          unusable = true;
          throw new AggregateError([error, rollbackError], 'Operation and rollback failed');
        }
        throw error;
      }
    });
    queue = operation.catch(() => undefined);
    return operation;
  }

  function close(): Promise<void> {
    if (!closeResult) {
      closing = true;
      closeResult = queue.then(() => connection.close());
    }
    return closeResult;
  }
  return { transaction, close };
}

export type Transactions = ReturnType<typeof createTransactions>;
