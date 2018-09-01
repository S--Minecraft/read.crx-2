isTabReadcrx = (tab) ->
  return tab.url.startsWith(browser.runtime.getURL(""))

# 実行中のread.crxを探す
searchRcrx = ->
  baseUrl = browser.runtime.getURL("")
  tabs = await browser.tabs.query(
    url: "#{baseUrl}*"
  )
  throw new Error("Not found") if tabs.length is 0
  return tabs[0]

# アイコンクリック時の動作
browser.browserAction.onClicked.addListener( (currentTab) ->
  # 現在のタブが自分自身なら何もしない
  return if isTabReadcrx(currentTab)

  try
    {windowId, id} = await searchRcrx()
  catch
    # 存在しなければタブを作成する
    browser.tabs.create(url: "/view/index.html")
    return
  # 実行中のread.crxが存在すればそれを開く
  browser.windows.update(windowId, focused: true)
  browser.tabs.update(id, active: true)
  return
)

# 終了通知の受信
browser.runtime.onMessage.addListener( ({type}) ->
  return unless type is "exit_rcrx"
  # zombie.htmlが動いているかもしれないので10秒待機
  setTimeout( ->
    try
      await searchRcrx()
    catch
      # 実行していなければメモリ解放のためにリロード
      browser.runtime.reload()
    return
  , 1000 * 10)
  return
)

# 対応URLのチェック
supportedURL = ///https?:\/\/(?:
  (?:[\w\.]+\/test\/read\.cgi\/\w+\/\d+\/.*?/)|
  (?:\w+\.machi\.to\/bbs\/read\.cgi\/\w+\/\d+\/.*?/)|
  (?:jbbs\.(?:livedoor\.jp|shitaraba\.net)\/bbs\/read(?:_archive)?\.cgi\/\w+\/\d+\/\d+\/.*?/)|
  (?:jbbs\.(?:livedoor\.jp|shitaraba\.net)\/\w+\/\d+\/storage\/\d+\.html$/)|
  (?:[\w\.]+\/\w+\/(?:#.*)?/)|
  (?:jbbs\.(?:livedoor\.jp|shitaraba\.net)\/\w+\/\d+\/(?:#.*)?/)
  )///

# コンテキストメニューの作成
browser.contextMenus.create(
  id: "open_link_in_rcrx"
  title: "リンクをread.crx-2で開く"
  contexts: ["link"]
  documentUrlPatterns: [
    "http://*/*"
    "https://*/*"
    "file://*/*"
  ]
  targetUrlPatterns: [
    "*://*.2ch.net/*"
    "*://*.5ch.net/*"
    "*://*.2ch.sc/*"
    "*://*.open2ch.net/*"
    "*://*.bbspink.com/*"
    "*://jbbs.shitaraba.net/*"
    "*://jbbs.livedoor.jp/*"
    "*://*.machi.to/*"
  ]
)

# コンテキストメニューのクリック時の動作
browser.contextMenus.onClicked.addListener( ({menuItemId, linkUrl: url}, tab) ->
  return unless menuItemId is "open_link_in_rcrx"

  # 対応URLであるか確認
  unless supportedURL.test(url)
    new Notification("未対応のURLです")
    return
  try
    {windowId, id} = await searchRcrx()
    # 実行中のread.crxが存在すればそれを開く
    browser.windows.update(windowId, focused: true)
    browser.tabs.update(id, active: true)
    browser.runtime.sendMessage(type: "open", query: url)
  catch
    # 存在しなければタブを作成する
    browser.tabs.create(url: "/view/index.html?q=#{url}")
  return
)
