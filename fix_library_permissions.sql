GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.library_levels TO postgres, service_role;
GRANT SELECT ON TABLE public.library_levels TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_library_config() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_library_config(int, bigint, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_library_level(int) TO anon, authenticated, service_role;
