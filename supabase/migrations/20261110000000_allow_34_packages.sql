DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint AS c
        JOIN pg_class AS table_info ON table_info.oid = c.conrelid
        JOIN pg_namespace AS schema_info ON schema_info.oid = table_info.relnamespace
        WHERE schema_info.nspname = 'public'
          AND table_info.relname = 'itens_encomenda'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%quantidade%'
          AND pg_get_constraintdef(c.oid) ~* 'quantidade.*(<= ?20|< ?21|between 1 and 20)'
    LOOP
        EXECUTE format('ALTER TABLE public.itens_encomenda DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS c
        JOIN pg_class AS table_info ON table_info.oid = c.conrelid
        JOIN pg_namespace AS schema_info ON schema_info.oid = table_info.relnamespace
        WHERE schema_info.nspname = 'public'
          AND table_info.relname = 'itens_encomenda'
          AND c.conname = 'itens_encomenda_quantidade_1_34'
    ) THEN
        ALTER TABLE public.itens_encomenda
            ADD CONSTRAINT itens_encomenda_quantidade_1_34
            CHECK (quantidade BETWEEN 1 AND 34);
    END IF;
END $$;
