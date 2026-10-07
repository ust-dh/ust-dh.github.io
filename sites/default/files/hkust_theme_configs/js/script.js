window.onload = function () {
  (function ($, Drupal) {
    if (window.location.pathname.includes('/photos-videos')) {
      if (!sessionStorage.getItem('pageRefreshed')) {
        sessionStorage.setItem('pageRefreshed', 'true');
        window.location.reload();
        return; // Stop execution of the rest of the script since page is reloading
      } else {
        sessionStorage.removeItem('pageRefreshed');
      }
    }
  })(jQuery, Drupal);
};