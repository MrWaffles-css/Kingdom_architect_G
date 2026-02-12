
// Spotify API Configuration
export const SPOTIFY_CLIENT_ID = '847380421e90462da685399a0c7c4368'; // User must replace this!
export const SPOTIFY_REDIRECT_URI = window.location.origin + '/spotify-callback'; // Or just root if simple
// Simple Implicit Grant for demo purposes (no backend required)
// Scopes: precise playback state, modify playback state
export const SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
];

export const getSpotifyAuthUrl = () => {
    return `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin)}&scope=${encodeURIComponent(SCOPES.join(' '))}&response_type=token&show_dialog=true`;
};

export const getSpotifyToken = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
};

export const removeHash = () => {
    window.location.hash = '';
};
