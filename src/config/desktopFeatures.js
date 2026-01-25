import Overview from '../components/Overview';
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

import kingdomIcon from '../assets/kingdom.png';
import barracksIcon from '../assets/barracks.png';
import goldmineIcon from '../assets/goldmine.png';
import computerIcon from '../assets/computer.png';

export const desktopFeatures = [
    { id: 'overview', title: 'My Computer', icon: computerIcon, isImage: true, component: Overview, defaultWidth: 700 },
    { id: 'recycle', title: 'Recycle Bin', icon: 'https://win98icons.alexmeub.com/icons/png/recycle_bin_empty-0.png', isImage: true, component: RecycleBin, defaultWidth: 400 },
    { id: 'kingdom', title: 'Kingdom', icon: kingdomIcon, isImage: true, component: Kingdom, defaultWidth: 600 },
    { id: 'barracks', title: 'Barracks', icon: barracksIcon, isImage: true, component: Barracks, defaultWidth: 650 },
    { id: 'battle', title: 'Battle Field', icon: '🛡️', isImage: false, component: Battle, defaultWidth: 800 },
    { id: 'goldmine', title: 'Gold Mine', icon: goldmineIcon, isImage: true, component: GoldMine, defaultWidth: 500 },
    { id: 'vault', title: 'Vault', icon: '💰', isImage: false, component: Vault, defaultWidth: 500 },
    { id: 'armoury', title: 'Armoury', icon: '⚔️', isImage: false, component: Armoury, defaultWidth: 650 },
    { id: 'library', title: 'Library', icon: '📚', isImage: false, component: Library, defaultWidth: 500 },
    { id: 'reports', title: 'Reports', icon: '📜', isImage: false, component: Reports, defaultWidth: 600 },
    { id: 'mail', title: 'Mail', icon: '📧', isImage: false, component: Mail, defaultWidth: 550 },
    { id: 'profile', title: 'Profile', icon: '👤', isImage: false, component: Profile, defaultWidth: 700 },
    { id: 'spy_report', title: 'Spy Report', icon: '🕵️', isImage: false, component: SpyReport, defaultWidth: 500, hidden: true },
    { id: 'news', title: 'News', icon: '📰', isImage: false, component: News, defaultWidth: 500 },
    { id: 'patch', title: 'Patch Notes', icon: '📋', isImage: false, component: PatchNotes, defaultWidth: 400 },
    { id: 'about', title: 'About', icon: 'ℹ️', isImage: false, component: About, defaultWidth: 400 },
    { id: 'help', title: 'Help', icon: '❓', isImage: false, component: Help, defaultWidth: 400 },
    { id: 'halloffame', title: 'Hall of Fame', icon: '🏆', isImage: false, component: HallOfFame, defaultWidth: 600 },
];
