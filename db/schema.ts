import {sqliteTable,integer,text} from 'drizzle-orm/sqlite-core';
export const event=sqliteTable('event',{id:integer('id').primaryKey(),payload:text('payload').notNull().default('[]'),version:integer('version').notNull().default(0)});
export const claims=sqliteTable('claims',{token:text('token').primaryKey(),device:text('device').notNull()});
