export const avatars = [
    { id: 'knight_m', name: 'Knight (Male)', src: '/avatars/avatar_knight_m.jpg' },
    { id: 'knight_f', name: 'Knight (Female)', src: '/avatars/avatar_knight_f.jpg' },
    { id: 'elf_m_green', name: 'Elf (Male)', src: '/avatars/avatar_elf_m_green.jpg' },
    { id: 'elf_f_silver', name: 'Elf (Female)', src: '/avatars/avatar_elf_f_silver.jpg' },
    { id: 'dwarf_m_blonde', name: 'Dwarf (Blonde)', src: '/avatars/avatar_dwarf_m_blonde.jpg' },
    { id: 'dwarf_m_horned', name: 'Dwarf (Horned)', src: '/avatars/avatar_dwarf_m_horned.jpg' },
];

export const getAvatarPath = (id) => {
    const avatar = avatars.find(a => a.id === id);
    return avatar ? avatar.src : null;
};
