import RecycleBin from '../components/RecycleBin';
import Kingdom from '../components/Kingdom';
import Barracks from '../components/Barracks';
import Battle from '../components/Battle';
import GoldMine from '../components/GoldMine';
import Vault from '../components/Vault';
import Armoury from '../components/Armoury';
import Library from '../components/Library';
import Reports from '../components/Reports';
import Mail from '../components/Mail';
import Profile from '../components/Profile';
import SpyReport from '../components/SpyReport';
import News from '../components/News';
import PatchNotes from '../components/PatchNotes';
import About from '../components/About';
import Help from '../components/Help';
import HallOfFame from '../components/HallOfFame';

export const desktopFeatures = [
    { id: 'recycle', title: 'Recycle Bin', icon: 'https://win98icons.alexmeub.com/icons/png/recycle_bin_empty-0.png', isImage: true, component: RecycleBin, defaultWidth: 400 },
    { id: 'kingdom', title: 'Kingdom', icon: '/kingdom_icon.png', isImage: true, component: Kingdom, defaultWidth: 600 },
    { id: 'barracks', title: 'Barracks', icon: '/barracks_icon.png', isImage: true, component: Barracks, defaultWidth: 650, iconClassName: 'w-12 h-12' },
    { id: 'battle', title: 'Battle Field', icon: '/battlefield_icon.png', isImage: true, component: Battle, defaultWidth: 800, iconClassName: 'w-12 h-12' },
    { id: 'goldmine', title: 'Gold Mine', icon: '/goldmine_icon.png', isImage: true, component: GoldMine, defaultWidth: 500, iconClassName: 'w-12 h-12' },
    { id: 'vault', title: 'Vault', icon: '/vault_icon.png', isImage: true, component: Vault, defaultWidth: 500, iconClassName: 'w-12 h-12' },
    { id: 'armoury', title: 'Armoury', icon: '/armoury_icon.png', isImage: true, component: Armoury, defaultWidth: 650, iconClassName: 'w-12 h-12' },
    { id: 'library', title: 'Library', icon: '/library_icon.png', isImage: true, component: Library, defaultWidth: 500, iconClassName: 'w-12 h-12' },
    { id: 'reports', title: 'Reports', icon: 'https://win98icons.alexmeub.com/icons/png/envelope_closed-0.png', isImage: true, component: Reports, defaultWidth: 600 },
    { id: 'mail', title: 'Mail', icon: 'https://win98icons.alexmeub.com/icons/png/outlook_express-0.png', isImage: true, component: Mail, defaultWidth: 550 },
    { id: 'profile', title: 'Profile', icon: 'https://win98icons.alexmeub.com/icons/png/users-1.png', isImage: true, component: Profile, defaultWidth: 700 },
    { id: 'spy_report', title: 'Spy Report', icon: 'https://win98icons.alexmeub.com/icons/png/keys-0.png', isImage: true, component: SpyReport, defaultWidth: 500, hidden: true },
    { id: 'news', title: 'News', icon: 'https://win98icons.alexmeub.com/icons/png/write_wordpad-1.png', isImage: true, component: News, defaultWidth: 500 },
    { id: 'patch', title: 'Patch Notes', icon: 'https://win98icons.alexmeub.com/icons/png/notepad-0.png', isImage: true, component: PatchNotes, defaultWidth: 400 },
    { id: 'about', title: 'About', icon: 'https://win98icons.alexmeub.com/icons/png/msg_information-0.png', isImage: true, component: About, defaultWidth: 400 },
    { id: 'help', title: 'Help', icon: 'https://win98icons.alexmeub.com/icons/png/help_question_mark-0.png', isImage: true, component: Help, defaultWidth: 400 },
    { id: 'halloffame', title: 'Hall of Fame', icon: 'https://win98icons.alexmeub.com/icons/png/certificate-0.png', isImage: true, component: HallOfFame, defaultWidth: 600 },
];
