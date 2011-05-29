app = {}

(->
  origin = chrome.extension.getURL("").slice(0, -1)

  exec = (javascript) ->
    script = document.createElement("script")
    script.innerHTML = javascript
    document.body.appendChild(script)

  main = ->
    if ///^http://\w+\.2ch\.net/test/read\.cgi/\w+/\d+/1\?///.test(location.href)
      form = document.createElement("form")
      form.action = "/test/bbs.cgi"
      form.method = "POST"

      form_data =
        submit: "書きこむ"
        time: Math.floor(Date.now() / 1000) - 60
        bbs: location.href.split("/")[5]
        key: location.href.split("/")[6]

      arg = app.url.parse_query(location.href)
      form_data.FROM = arg.rcrx_name
      form_data.mail = arg.rcrx_mail
      form_data.MESSAGE = arg.rcrx_message

      for key, val of form_data
        input = document.createElement("input")
        input.name = key
        input.setAttribute("value", val)
        form.appendChild(input)

      form.__proto__.submit.call(form)

    else if ///^http://\w+\.2ch\.net/test/bbs\.cgi///.test(location.href)
      if /書きこみました/.test(document.title)
        exec """
          parent.postMessage(JSON.stringify({type : "success"}), "#{origin}");
        """
      else if /確認/.test(document.title)
        exec """
          parent.postMessage(JSON.stringify({type : "confirm"}), "#{origin}");
        """
      else if /ＥＲＲＯＲ/.test(document.title)
        exec """
          parent.postMessage(JSON.stringify({type : "error"}), "#{origin}");
        """

    else if ///^http://jbbs\.livedoor\.jp/bbs/read\.cgi/\w+/\d+/\d+/1\?///.test(location.href)
      tmp = location.href.split("/")

      form = document.createElement("form")
      form.action = "/bbs/write.cgi/#{tmp[5]}/#{tmp[6]}/#{tmp[7]}/"
      form.method = "POST"

      arg = app.url.parse_query(location.href)

      form_data =
        TIME: Math.floor(Date.now() / 1000) - 60
        DIR: tmp[5]
        BBS: tmp[6]
        KEY: tmp[7]
        NAME: arg.rcrx_name
        MAIL: arg.rcrx_mail

      for key, val of form_data
        input = document.createElement("input")
        input.name = key
        input.setAttribute("value", val)
        form.appendChild(input)

      textarea = document.createElement("textarea")
      textarea.name = "MESSAGE"
      textarea.value = arg.rcrx_message
      form.appendChild(textarea)

      form.submit()

    else if ///^http://jbbs\.livedoor\.jp/bbs/write.cgi/\w+/\d+/\d+/$///.test(location.href)
      if /書きこみました/.test(document.title)
        exec """
          parent.postMessage(JSON.stringify({type : "success"}), "#{origin}");
        """
      else if /ERROR/.test(document.title)
        exec """
          parent.postMessage(JSON.stringify({type : "error"}), "#{origin}");
        """

  boot = ->
    window.addEventListener "message", (e) ->
      if e.origin is origin and e.data is "write_iframe_pong"
        main()

    exec """
      parent.postMessage(JSON.stringify({type : "ping"}), "#{origin}");
    """

  setTimeout(boot, 0)
)()