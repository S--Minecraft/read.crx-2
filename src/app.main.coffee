(->
  if location.pathname isnt "/app.html"
    return

  xhr = new XMLHttpRequest()
  xhr.open("GET", "/manifest.json", false)
  xhr.send(null)
  app.manifest = JSON.parse(xhr.responseText)

  html_version = document.documentElement.getAttribute("data-app-version")
  if app.manifest.version isnt html_version
    location.reload(true)

  reg_res = /[\?&]q=([^&]+)/.exec(location.search)
  query = decodeURIComponent(reg_res?[1] or "app")

  chrome.tabs.getCurrent (current_tab) ->
    chrome.windows.getAll {populate: true}, (windows) ->
      app_path = chrome.extension.getURL("app.html")
      for win in windows
        for tab in win.tabs
          if tab.id isnt current_tab.id and tab.url is app_path
            chrome.windows.update(win.id, focused: true)
            chrome.tabs.update(tab.id, selected: true)
            if query isnt "app"
              chrome.tabs.sendRequest(tab.id, {type: "open", query})
            chrome.tabs.remove(current_tab.id)
            return
      history.pushState(null, null, "/app.html")
      $ ->
        app.main()
        if query isnt "app"
          app.message.send("open", url: query)
)()

app.main = ->
  document.title = app.manifest.name

  #サイドメニューのセットアップ
  $("#left_pane").append(app.view_sidemenu.open())

  #タブ・ペインセットアップ
  layout = app.config.get("layout") or "pane-3"

  if layout is "pane-3"
    $("#body").addClass("pane-3")
    $("#tab_a, #tab_b").tab()
    $(".tab .tab_tabbar").sortable()
    app.view_setup_resizer()

  else if layout is "pane-3h"
    $("#body").addClass("pane-3h")
    $("#tab_a, #tab_b").tab()
    $(".tab .tab_tabbar").sortable()
    app.view_setup_resizer()

  else if layout is "pane-2"
    $("#body").addClass("pane-2")
    $("#tab_a").tab()
    $("#tab_b, #tab_resizer").remove()
    $(".tab .tab_tabbar").sortable()

  #タブの状態の保存/復元関連
  is_restored = app.view_tab_state.restore()
  window.addEventListener "unload", ->
    app.view_tab_state.store()

  #もし、タブが一つも復元されなかったらブックマークタブを開く
  unless is_restored
    app.message.send("open", url: "bookmark")

  #openメッセージ受信部
  app.message.add_listener "open", (message) ->
    $view = $(".tab_container")
      .find("> [data-url=\"#{app.url.fix(message.url)}\"]")

    get_view = (url) ->
      guess_result = app.url.guess_type(url)

      if url is "config"
        $view = app.view_config.open()
      else if url is "history"
        $view = app.view_history.open()
      else if url is "bookmark"
        $view = app.view_bookmark.open()
      else if url is "inputurl"
        $view = app.view_inputurl.open()
      else if guess_result.type is "board"
        $view = app.view_board.open(message.url)
      else if guess_result.type is "thread"
        $view = app.view_thread.open(message.url)
      else
        null

    if $view.length is 1
      $view
        .closest(".tab")
          .tab("select", tab_id: $view.attr("data-tab_id"))
      return
    else
      $view = get_view(message.url)

    if $view
      target = "#tab_a"
      if $view.hasClass("view_thread")
        target = document.getElementById("tab_b") or target

      $(target)
        .tab("add", element: $view[0], title: $view.attr("data-title"))

  #openリクエストの監視
  chrome.extension.onRequest.addListener (request) ->
    if request.type is "open"
      app.message.send("open", url: request.query)

  #書き込み完了メッセージの監視
  chrome.extension.onRequest.addListener (request) ->
    if request.type is "written"
      $(".view_thread[data-url=\"#{request.url}\"]")
        .trigger("request_reload", force_update: true)

  $(window)
    #更新系のキーが押された時の処理
    .bind "keydown", (e) ->
      if e.which is 116 or (e.ctrlKey and e.which is 82) #F5 or Ctrl+R
        e.preventDefault()
        $(".tab .tab_container .tab_focused").trigger("request_reload")

    #データ保存等の後片付けを行なってくれるzombie.html起動
    .bind "unload", ->
      if localStorage.zombie_read_state?
        open("/zombie.html", undefined, "left=1,top=1,width=250,height=50")

  $(document.documentElement)
    #a.open_in_rcrxがクリックされた場合にopenメッセージを送出する
    .delegate ".open_in_rcrx", "click", (e) ->
      e.preventDefault()
      app.message.send "open",
        url: this.href or this.getAttribute("data-href")

    #タブ内コンテンツがtitle_updatedを送出した場合、タブのタイトルを更新する
    .delegate ".tab_content", "title_updated", ->
      $this = $(this)
      $this
        .closest(".tab")
          .tab("update_title", {
            tab_id: $this.attr("data-tab_id")
            title: $this.attr("data-title")
          })

    #タブ内コンテンツがview_request_killmeを送って来た場合、タブを閉じる。
    .delegate ".tab_content", "view_request_killme", ->
      $this = $(this)
      $this.closest(".tab").tab("remove", tab_id: $this.attr("data-tab_id"))

    #tab_removedイベントをview_unloadに翻訳
    .delegate ".tab_content", "tab_removed", ->
      $(this).trigger("view_unload")

    #フォーカス管理
    #タブの内容がクリックされた時にフォーカスを移動
    .delegate ".tab_content", "mousedown", ->
      if not this.classList.contains("tab_focused")
        $(".tab_focused")
          .removeClass("tab_focused")

        $(this)
          .closest(".tab")
            .find(".tab_selected")
              .addClass("tab_focused")
              .find(".content")
                .focus()

    #タブが選択された時にフォーカスを移動
    .delegate ".tab_content", "tab_selected", ->
      $(".tab_focused").removeClass("tab_focused")
      $(this).closest(".tab").find(".tab_selected").addClass("tab_focused")
      #クリックでタブを選択した時にフォーカスが移らなくなるため、deferで飛ばす
      app.defer ->
        $(".tab_focused .content").focus()

    #フォーカスしているタブが削除された時にフォーカスを移動
    .delegate ".tab_content", "tab_removed", ->
      $tmp =  $(this).closest(".tab").find(".tab_selected")
      if $tmp.filter(".tab_content").is(this)
        app.defer ->
          $(".tab:has(.tab_selected):first")
            .find(".tab_selected")
              .addClass("tab_focused")
              .find(".content")
                .focus()

    #フォーカスしているタブ内のコンテンツが再描画された場合、フォーカスを合わせ直す
    .delegate ".tab_content", "view_loaded", ->
      if this.classList.contains("tab_focused")
        this.getElementsByClassName("content")[0]?.focus()
