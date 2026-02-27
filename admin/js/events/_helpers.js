/**
 * AIOEMP Events — Shared Helpers
 *
 * Pure utility functions used across all event modules.
 * Loaded first; registers on the shared context object.
 *
 * @package AIOEMP
 * @since   0.3.0
 */
(function ($, ctx) {
    'use strict';

    function esc(str) {
        var el = document.createElement('span');
        el.textContent = str || '';
        return el.innerHTML;
    }

    /**
     * Navigate to a hash route, forcing hashchange even when
     * the target is the same as the current hash.
     */
    function goToHash(target) {
        var full = target.charAt(0) === '#' ? target : '#' + target;
        if (location.hash === full) {
            $(window).trigger('hashchange');
        } else {
            location.hash = full;
        }
    }

    function fmtDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr + (dateStr.indexOf('Z') === -1 ? 'Z' : ''));
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function fmtDateTime(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr + (dateStr.indexOf('Z') === -1 ? 'Z' : ''));
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
               ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    /** Convert local datetime-local input value to GMT string for API */
    function localToGmt(localStr) {
        if (!localStr) return '';
        var d = new Date(localStr);
        if (isNaN(d.getTime())) return '';
        return d.getUTCFullYear() + '-' +
               String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
               String(d.getUTCDate()).padStart(2, '0') + ' ' +
               String(d.getUTCHours()).padStart(2, '0') + ':' +
               String(d.getUTCMinutes()).padStart(2, '0') + ':' +
               String(d.getUTCSeconds()).padStart(2, '0');
    }

    /** Convert GMT datetime from API to local datetime-local input value */
    function gmtToLocal(gmtStr) {
        if (!gmtStr) return '';
        var d = new Date(gmtStr + (gmtStr.indexOf('Z') === -1 ? 'Z' : ''));
        if (isNaN(d.getTime())) return '';
        var y  = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, '0');
        var da = String(d.getDate()).padStart(2, '0');
        var h  = String(d.getHours()).padStart(2, '0');
        var mi = String(d.getMinutes()).padStart(2, '0');
        return y + '-' + mo + '-' + da + 'T' + h + ':' + mi;
    }

    function statusBadge(status) {
        return '<span class="aioemp-badge aioemp-badge--' + esc(status || 'draft') + '">' + esc(status || 'draft') + '</span>';
    }

    function venueBadge(mode) {
        if (!mode) return '—';
        var cls = mode === 'onsite' ? 'info' : mode === 'online' ? 'success' : 'warning';
        return '<span class="aioemp-badge aioemp-badge--' + cls + '">' + esc(mode) + '</span>';
    }

    /* ── Register on context ── */
    ctx.esc         = esc;
    ctx.goToHash    = goToHash;
    ctx.fmtDate     = fmtDate;
    ctx.fmtDateTime = fmtDateTime;
    ctx.localToGmt  = localToGmt;
    ctx.gmtToLocal  = gmtToLocal;
    ctx.statusBadge = statusBadge;
    ctx.venueBadge  = venueBadge;

})(jQuery, window.AIOEMP_Events);
