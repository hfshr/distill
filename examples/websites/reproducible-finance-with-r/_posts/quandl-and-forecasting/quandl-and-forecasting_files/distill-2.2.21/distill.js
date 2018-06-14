
// jquery plugin to change element types
(function($) {
  $.fn.changeElementType = function(newType) {
    var attrs = {};

    $.each(this[0].attributes, function(idx, attr) {
      attrs[attr.nodeName] = attr.nodeValue;
    });

    this.replaceWith(function() {
      return $("<" + newType + "/>", attrs).append($(this).contents());
    });
  };
})(jQuery);


function is_downlevel_browser() {
  if (bowser.isUnsupportedBrowser({ msie: "12", msedge: "16"},
                                 window.navigator.userAgent)) {
    return true;
  } else {
    return window.load_distill_framework === undefined;
  }
}

// show body when load is complete
function on_load_complete() {

  // set body to visible
  document.body.style.visibility = 'visible';

  // trigger 'shown' so htmlwidgets resize
  $('d-article').trigger('shown');
}

if (is_downlevel_browser()) {
  document.addEventListener('DOMContentLoaded', init_downlevel);
} else {
  window.addEventListener('WebComponentsReady', init_distill);
}

function init_distill() {

  init_common();

  // create front matter
  var front_matter = $('<d-front-matter></d-front-matter>');
  $('#distill-front-matter').wrap(front_matter);

  // create d-title
  $('.d-title').changeElementType('d-title');

  // create d-byline
  var byline = $('<d-byline></d-byline>');
  $('.d-byline').replaceWith(byline);

  // create d-article
  var article = $('<d-article></d-article>');
  $('.d-article').wrap(article).children().unwrap();

  // move post list into article
  $('.posts-list').appendTo($('d-article'));

  // create d-appendix
  $('.d-appendix').changeElementType('d-appendix');

  // create d-bibliography
  var bibliography = $('<d-bibliography></d-bibliography>');
  $('#distill-bibliography').wrap(bibliography);

  // flag indicating that we have appendix items
  var appendix = $('.appendix-bottom').children('h3').length > 0;

  // replace citations with <d-cite>
  $('.citation').each(function(i, val) {
    appendix = true;
    var cites = $(this).attr('data-cites').split(" ");
    var dt_cite = $('<d-cite></d-cite>');
    dt_cite.attr('key', cites.join());
    $(this).replaceWith(dt_cite);
  });
  // remove refs
  $('#refs').remove();

  // replace footnotes with <d-footnote>
  $('.footnote-ref').each(function(i, val) {
    appendix = true;
    var href = $(this).attr('href');
    var id = href.replace('#', '');
    var fn = $('#' + id);
    var fn_p = $('#fn1>p');
    fn_p.find('.footnote-back').remove();
    var text = fn_p.text();
    var dtfn = $('<d-footnote></d-footnote>');
    dtfn.text(text);
    $(this).replaceWith(dtfn);
  });
  // remove footnotes
  $('.footnotes').remove();

  $('h1.appendix, h2.appendix').each(function(i, val) {
    $(this).changeElementType('h3');
  });
  $('h3.appendix').each(function(i, val) {
    var id = $(this).attr('id');
    $('.d-toc a[href="#' + id + '"]').parent().remove();
    appendix = true;
    $(this).nextUntil($('h1, h2, h3')).addBack().appendTo($('d-appendix'));
  });

  // show d-appendix if we have appendix content
  $("d-appendix").css('display', appendix ? 'grid' : 'none');

  // replace code blocks with d-code
  $('pre>code').each(function(i, val) {
    var code = $(this);
    var pre = code.parent();
    var clz = "";
    var language = pre.attr('class');
    if (language) {
      if ($.inArray(language, ["r", "cpp", "c", "java"]) != -1)
        language = "clike";
      language = ' language="' + language + '"';
      var dt_code = $('<d-code block' + language + clz + '></d-code>');
      dt_code.text(code.text());
      pre.replaceWith(dt_code);
    } else {
      code.addClass('text-output').unwrap().changeElementType('pre');
    }
  });

  // localize layout chunks to just output
  $('.layout-chunk').each(function(i, val) {

    // capture layout
    var layout = $(this).attr('data-layout');

    // apply layout to markdown level block elements
    $(this).children().not('d-code, pre.text-output')
      .wrap($('<div class="' + layout + '"></div>'));

    // unwrap the layout-chunk div
    $(this).children().unwrap();
  });

  // load distill framework
  load_distill_framework();

  // wait for window.distillRunlevel == 4 to do post processing
  function distill_post_process() {

    if (!window.distillRunlevel || window.distillRunlevel < 4)
      return;

    // hide author/affiliations entirely if we have no authors
    var front_matter = JSON.parse($("#distill-front-matter").html());
    var have_authors = front_matter.authors && front_matter.authors.length > 0;
    if (!have_authors)
      $('d-byline').addClass('hidden');

    // table of contents
    if (have_authors) // adjust border if we are in authors
      $('.d-toc').parent().addClass('d-article-with-toc');

    // strip links that point to #
    $('.authors-affiliations').find('a[href="#"]').removeAttr('href');

    // hide elements of author/affiliations grid that have no value
    function hide_byline_column(caption) {
      $('d-byline').find('h3:contains("' + caption + '")').parent().css('visibility', 'hidden');
    }

    // affiliations
    var have_affiliations = false;
    for (var i = 0; i<front_matter.authors.length; ++i) {
      var author = front_matter.authors[i];
      if (author.affiliation !== "&nbsp;") {
        have_affiliations = true;
        break;
      }
    }
    if (!have_affiliations)
      $('d-byline').find('h3:contains("Affiliations")').css('visibility', 'hidden');

    // published date
    if (!front_matter.publishedDate)
      hide_byline_column("Published");

    // document object identifier
    var doi = $('d-byline').find('h3:contains("DOI")');
    var doi_p = doi.next().empty();
    if (!front_matter.doi) {
      // if we have a citation and valid citationText then link to that
      if ($('#citation').length > 0 && front_matter.citationText) {
        doi.html('Citation');
        $('<a href="#citation"></a>')
          .text(front_matter.citationText)
          .appendTo(doi_p);
      } else {
        hide_byline_column("DOI");
      }
    } else {
      $('<a></a>')
         .attr('href', "https://doi.org/" + front_matter.doi)
         .html(front_matter.doi)
         .appendTo(doi_p);
    }

     // change plural form of authors/affiliations
    if (front_matter.authors.length === 1) {
      var grid = $('.authors-affiliations');
      grid.children('h3:contains("Authors")').text('Author');
      grid.children('h3:contains("Affiliations")').text('Affiliation');
    }

    // inject pre code styles (can't do this with a global stylesheet b/c a shadow root is used)
    $('d-code').each(function(i, val) {
      var style = document.createElement('style');
      style.innerHTML = 'pre code { padding-left: 10px; font-size: 12px; border-left: 2px solid rgba(0,0,0,0.1); } ' +
                        '@media(min-width: 768px) { pre code { padding-left: 18px; font-size: 14px; } }';
      if (this.shadowRoot)
        this.shadowRoot.appendChild(style);
    });

    // move appendix-bottom entries to the bottom
    $('.appendix-bottom').appendTo('d-appendix').children().unwrap();
    $('.appendix-bottom').remove();

    // clear polling timer
    clearInterval(tid);

    // show body now that everything is ready
    on_load_complete();
  }

  var tid = setInterval(distill_post_process, 50);
  distill_post_process();

}


function init_downlevel() {

  init_common();

   // insert hr after d-title
  $('.d-title').after($('<hr class="section-separator"/>'));

  // check if we have authors
  var front_matter = JSON.parse($("#distill-front-matter").html());
  var have_authors = front_matter.authors && front_matter.authors.length > 0;

  // manage byline/border
  if (!have_authors)
    $('.d-byline').remove();
  $('.d-byline').after($('<hr class="section-separator"/>'));
  $('.d-byline a').remove();

  // remove toc
  $('.d-toc-header').remove();
  $('.d-toc').remove();
  $('.d-toc-separator').remove();

  // move appendix elements
  $('h1.appendix, h2.appendix').each(function(i, val) {
    $(this).changeElementType('h3');
  });
  $('h3.appendix').each(function(i, val) {
    $(this).nextUntil($('h1, h2, h3')).addBack().appendTo($('.d-appendix'));
  });


  // inject headers into references and footnotes
  var refs_header = $('<h3></h3>');
  refs_header.text('References');
  $('#refs').prepend(refs_header);

  var footnotes_header = $('<h3></h3');
  footnotes_header.text('Footnotes');
  $('.footnotes').children('hr').first().replaceWith(footnotes_header);

  // move appendix-bottom entries to the bottom
  $('.appendix-bottom').appendTo('.d-appendix').children().unwrap();
  $('.appendix-bottom').remove();

  // remove appendix if it's empty
  if ($('.d-appendix').children().length === 0)
    $('.d-appendix').remove();

  // prepend separator above appendix
  $('.d-appendix').before($('<hr class="section-separator"/>'));

  // trim code
  $('pre>code').each(function(i, val) {
    $(this).html($.trim($(this).html()));
  });

  $('body').addClass('downlevel');

  on_load_complete();
}


function init_common() {

  // prevent underline for linked images
  $('a > img').parent().css({'border-bottom' : 'none'});

  // mark figures created by knitr chunks as 100% width
  $('.layout-chunk').each(function(i, val) {
    $(this).find('img, .html-widget').css('width', '100%');
  });

  // auto-append index.html to post-preview links in file: protocol
  // and in rstudio ide preview
  $('.post-preview').each(function(i, val) {
    if (window.location.protocol === "file:")
      $(this).attr('href', $(this).attr('href') + "index.html");
  });

  // add class to pandoc style tables
  $('tr.header').parent('thead').parent('table').addClass('pandoc-table');
  $('.kable-table').children('table').addClass('pandoc-table');

}

