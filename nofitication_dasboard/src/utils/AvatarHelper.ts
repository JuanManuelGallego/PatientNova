
function getInitials(name: string, lastName: string) {
    return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarColor(id: string) {
    const hues = [ 200, 160, 280, 30, 340, 60, 240 ];
    const idx = id.charCodeAt(0) % hues.length;
    return `hsl(${hues[ idx ]}, 55%, 82%)`;
}

export { getInitials, getAvatarColor };