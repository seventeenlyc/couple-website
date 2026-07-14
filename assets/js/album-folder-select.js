(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.AlbumFolderSelect = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    function buildOptions(folders, currentPath) {
        const validFolders = (Array.isArray(folders) ? folders : [])
            .filter(folder => folder && typeof folder.path === 'string' && folder.path !== '')
            .slice()
            .sort((left, right) => left.path.localeCompare(
                right.path,
                undefined,
                { numeric: true, sensitivity: 'base' }
            ));

        const options = [{ value: '', label: '根目录' }].concat(
            validFolders.map(folder => ({
                value: folder.path,
                label: folder.path.split('/').join(' / ')
            }))
        );
        const requestedPath = typeof currentPath === 'string' ? currentPath : '';
        const selectedValue = options.some(option => option.value === requestedPath)
            ? requestedPath
            : '';

        return { options, selectedValue };
    }

    return { buildOptions };
});
