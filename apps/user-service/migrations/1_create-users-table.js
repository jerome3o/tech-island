exports.up = (pgm) => {
  pgm.createTable('users', {
    email: {
      type: 'varchar(255)',
      primaryKey: true,
      notNull: true,
      comment: 'User email from OAuth (X-Auth-Request-User header)',
    },
    display_name: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'User display name',
    },
    avatar_url: {
      type: 'text',
      notNull: false,
      comment: 'URL to user avatar image',
    },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
      comment: 'Flexible JSON field for app-specific user data',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create index on created_at for sorting/querying by registration date
  pgm.createIndex('users', 'created_at');

  // Create function to automatically update updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Create trigger to automatically update updated_at on row updates
  pgm.sql(`
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  // Drop trigger and function
  pgm.sql('DROP TRIGGER IF EXISTS update_users_updated_at ON users;');
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column();');

  // Drop table (cascade to drop indexes)
  pgm.dropTable('users', { cascade: true });
};
