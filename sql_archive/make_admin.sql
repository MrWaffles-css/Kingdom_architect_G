-- Script to make a user an admin
-- Replace 'YOUR_USERNAME_HERE' with the username you want to promote

UPDATE public.profiles
SET is_admin = true
WHERE username = 'YOUR_USERNAME_HERE';

-- Verify the change
SELECT * FROM public.profiles WHERE is_admin = true;
