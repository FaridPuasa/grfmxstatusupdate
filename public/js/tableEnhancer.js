// Adds a search box, row count, pagination, and click-to-sort headers to a results
// table, entirely client-side. Meant for tables that are built once (fully replaced,
// not incrementally appended to) from a batch of results - e.g. bulk update/scan
// result tables that can run into the hundreds/thousands of rows with no built-in
// way to find or page through a specific row.
//
// Usage: enhanceResultsTable(tableElement, { pageSize: 25 })
function enhanceResultsTable(table, options = {}) {
    if (!table || !table.tBodies.length || table.dataset.enhanced === 'true') return;

    const tbody = table.querySelector('tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));

    // Not worth the toolbar/pagination chrome for small result sets.
    const pageSize = options.pageSize || 25;
    if (allRows.length <= pageSize && allRows.length < 8) return;

    table.dataset.enhanced = 'true';

    let currentPage = 1;
    let filteredRows = allRows.slice();
    let sortColumnIndex = null;
    let sortAscending = true;

    const toolbar = document.createElement('div');
    toolbar.className = 'd-flex justify-content-between align-items-center mb-2 flex-wrap gap-2';
    toolbar.innerHTML = `
        <input type="search" class="form-control form-control-sm" style="max-width:240px;" placeholder="Search table...">
        <small class="text-muted"></small>
    `;
    const searchInput = toolbar.querySelector('input');
    const countLabel = toolbar.querySelector('small');
    table.parentNode.insertBefore(toolbar, table);

    const pager = document.createElement('div');
    pager.className = 'd-flex justify-content-between align-items-center mt-2';
    pager.innerHTML = `
        <small class="text-muted"></small>
        <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary" data-dir="prev">&lsaquo; Prev</button>
            <button type="button" class="btn btn-outline-secondary" data-dir="next">Next &rsaquo;</button>
        </div>
    `;
    const pagerInfo = pager.querySelector('small');
    const prevBtn = pager.querySelector('[data-dir="prev"]');
    const nextBtn = pager.querySelector('[data-dir="next"]');
    table.parentNode.insertBefore(pager, table.nextSibling);

    function render() {
        const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * pageSize;
        const pageRows = filteredRows.slice(start, start + pageSize);
        const pageRowSet = new Set(pageRows);

        allRows.forEach(row => {
            row.style.display = pageRowSet.has(row) ? '' : 'none';
        });

        const total = allRows.length;
        countLabel.textContent = filteredRows.length === total
            ? `${total} row${total === 1 ? '' : 's'}`
            : `${filteredRows.length} of ${total} rows`;

        pagerInfo.textContent = filteredRows.length === 0
            ? 'No matching rows'
            : `Showing ${start + 1}-${Math.min(start + pageRows.length, filteredRows.length)} of ${filteredRows.length}`;

        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
        pager.style.display = (totalPages <= 1) ? 'none' : 'flex';
    }

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        filteredRows = !q ? allRows.slice() : allRows.filter(row => row.textContent.toLowerCase().includes(q));
        currentPage = 1;
        render();
    });

    prevBtn.addEventListener('click', () => { currentPage--; render(); });
    nextBtn.addEventListener('click', () => { currentPage++; render(); });

    const headerRow = table.querySelector('thead tr:last-child');
    if (headerRow) {
        Array.from(headerRow.children).forEach((th, index) => {
            th.style.cursor = 'pointer';
            th.title = 'Click to sort';
            th.addEventListener('click', () => {
                sortAscending = sortColumnIndex === index ? !sortAscending : true;
                sortColumnIndex = index;

                headerRow.querySelectorAll('.sort-indicator').forEach(el => el.remove());
                const indicator = document.createElement('span');
                indicator.className = 'sort-indicator';
                indicator.style.marginLeft = '4px';
                indicator.textContent = sortAscending ? '▲' : '▼';
                th.appendChild(indicator);

                const cellText = (row) => (row.children[index] ? row.children[index].textContent.trim() : '');
                const numeric = allRows.every(row => {
                    const v = cellText(row);
                    return v === '' || !isNaN(parseFloat(v.replace(/[^0-9.\-]/g, '')));
                });

                const compare = (a, b) => {
                    const va = cellText(a);
                    const vb = cellText(b);
                    if (numeric) {
                        const na = parseFloat(va.replace(/[^0-9.\-]/g, '')) || 0;
                        const nb = parseFloat(vb.replace(/[^0-9.\-]/g, '')) || 0;
                        return sortAscending ? na - nb : nb - na;
                    }
                    return sortAscending ? va.localeCompare(vb) : vb.localeCompare(va);
                };

                allRows.sort(compare);
                allRows.forEach(row => tbody.appendChild(row));
                filteredRows.sort(compare);
                currentPage = 1;
                render();
            });
        });
    }

    render();
}
