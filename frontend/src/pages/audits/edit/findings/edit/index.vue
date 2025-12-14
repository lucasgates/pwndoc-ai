<template src='./edit.html'></template>

<script src='./edit.js'></script>

<style scoped>
.sortable-drag img {
    position: relative;
    max-width: 600px!important;
    max-height: 600px!important;
}
.paragraph-ghost .sortable-ghost img {
    max-width: 600px!important;
    max-height: 600px!important;
}

.after-class {
    height: calc(100vh - 132px)!important;
}

.top-fixed {
    position: fixed;
    top: 100px;
    z-index: 1000;
}

.scrollarea-comments {
    height: calc(100vh - 152px)!important;
}

.scrollarea-comments-retest {
    height: calc(100vh - 104px)!important;
}

.content {
    margin-top: 100px;
}

.content-retest {
    margin-top: 50px;
}
</style>

<style>
/* AI Check Modal - Light Mode */
.ai-check-modal {
    background-color: #f5f5f5;
}

.ai-check-panel {
    background-color: #ffffff;
    border-radius: 0;
}

.ai-suggestions-panel {
    border-left: 1px solid #e0e0e0;
}

.ai-check-tabs {
    background-color: #eceff1;
    border-radius: 4px;
}

.ai-check-footer {
    background-color: #ffffff;
    border-top: 1px solid #e0e0e0;
}

.ai-changed-field {
    background-color: rgba(33, 150, 243, 0.1);
    border-radius: 4px;
}

.ai-issues-card {
    background-color: #fff3e0;
    color: #e65100;
}

/* AI Check Modal - Dark Mode */
.body--dark .ai-check-modal {
    background-color: #1d1d1d;
}

.body--dark .ai-check-panel {
    background-color: #2d2d2d;
}

.body--dark .ai-suggestions-panel {
    border-left: 1px solid #424242;
}

.body--dark .ai-check-tabs {
    background-color: #383838;
}

.body--dark .ai-check-footer {
    background-color: #2d2d2d;
    border-top: 1px solid #424242;
}

.body--dark .ai-changed-field {
    background-color: rgba(33, 150, 243, 0.2);
}

.body--dark .ai-issues-card {
    background-color: #3e2723;
    color: #ffab91;
}

.body--dark .ai-check-footer .q-btn--flat {
    color: #ffffff;
}
</style>