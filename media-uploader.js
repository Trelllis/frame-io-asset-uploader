;(function() {
  // This mini-app lets user upload his media (video/images/etc)
  // to our Frame.IO dashboard. Our team then gathers feedback from
  // the brand (client). Then user (creator) updates his media
  // based on the feedback from the brand and our team and uploads
  // new version. This process repeats. Then, when the brand and our team
  // are satisfied with the result, creator publishes the final version
  // on his/her social page. Marketing campaign usually includes many creatos.
  // For more information, please reach Rim or Kinane.

  // Retool is used as middleware between FE and Frame.IO API/our BE. So the Frame.IO/our BE
  // secret tokens are not exposed publicly - they are hidden inside our Retool App.
  // If Retool App has to be edited/updated, ask Bohdan (me) or Kinane.

  // P.S. This snippet is more 10k charactes, so it cannot be used in Weblow's Embed
  // custom code block. So it has to be stored in GitHub and hosted somehow.
  
  // This snippet requires a custom code block placed above it with all the HTML and CSS for the form.
  // An example of such form can be found in sample-form.html

  // How it works? (briefly)
  // 1. Prepare the form (add event listeners, initialize model variables, ...)
  // 2. Add invisible Retool App and wait for it to fully load (max waiting time is 1 min)
  // 3. Receive 'retoolAppIsReady' message from Retool iFrame (google 'iframe postMessage')
  // 4. Wait for user to fill the form
  // 5. Ask Retool to generate signed upload URL so we can upload media file to our Google Storage
  //    Retool App, in turn, asks our BE to generate it and relays the response back
  // 6. Receive 'signedUploadURLDetails' message from Retool iFrame
  // 7. Upload file to Storage using FormData POST request. File is now accessible by external public URL
  // 8. Ask Retool to create new Frame.IO asset with `sourceUrl` being our file's public URL
  // 9. Frame.IO will start downloading the file by its URL
  // 10. Receive 'createdAssetId' message from Retool iFrame
  // 11. Display Success dialog and reset the form
  

  // TODO:
  // 1. window.sociataFrameIoFolderAssetId is not used in askToCreateNewAsset() - fix that
  // 2. be silent in prod. see log()
  // 3. add error reporting to Mixpanel or Google Analytics









  // helper function
  function log(...args) {
    // TODO:
    // if prod => silent mode
    console.log('SOCIATA-MARKETING-CONTENT-UPLOADER', ...args)
  }

  // helper function
  function reportError(message, ...args) {
    // TODO: add sending events to Mixpanel or Google Analytics
    console.log('SOCIATA-MARKETING-CONTENT-UPLOADER', message, ...args)
  }

  // call in case this mini-app cannot even properly initialize
  // or it cannot continue running properly
  function displayGlobalCriticalErrorState(errorCode) {
    // another name for this function could be emergencyBrake().
    // current implementation is kinda dumb because it will not work unless
    // these two elements can be found on the page.
    // ideally, this function should not rely on anything, maximum independency.
    const mainContainerEl = document.querySelector('[data-sociata-social-marketing-content-uploader]')
    if (!mainContainerEl) {
      reportError('ERROR in displayGlobalCriticalErrorState(): cannot find [data-sociata-social-marketing-content-uploader]')
      return
    }
    const criticalErrorEl = document.querySelector('[data-sociata-global-critical-error]')
    if (!criticalErrorEl) {
      reportError('ERROR in displayGlobalCriticalErrorState(): cannot find [data-sociata-global-critical-error]')
      return
    }
    const globalErrorCodeEl = document.querySelector('[data-sociata-global-error-code]')
    if (!globalErrorCodeEl) {
      reportError('ERROR in displayGlobalCriticalErrorState(): cannot find [data-sociata-global-error-code]')
      return
    }
    mainContainerEl.style.pointerEvents = 'none'
    mainContainerEl.style.opacity = '0.3'
    criticalErrorEl.setAttribute('data-rendered', true)
    globalErrorCodeEl.textContent = errorCode || ''
  }


  // cannot proceed without this. this is Frame.IO folder (asset) ID
  // where user's media file will end up eventually
  if (!window.sociataFrameIoFolderAssetId) {
    reportError('ERROR during initializing: window.sociataFrameIoFolderAssetId is not defined')
    displayGlobalCriticalErrorState('#001')
    return
  }

  // initialize constants holding crucial DOM elements
  const usernameInputEl = document.querySelector('[data-sociata-username-input-element]')
  if (!usernameInputEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-username-input-element]')
    displayGlobalCriticalErrorState('#002')
    return
  }
  
  const fileInputEl = document.querySelector('[data-sociata-file-input-element]')
  if (!fileInputEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-file-input-element]')
    displayGlobalCriticalErrorState('#003')
    return
  }
  
  const selectFileButtonEl = document.querySelector('[data-sociata-select-file-button]')
  if (!selectFileButtonEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-select-file-button]')
    displayGlobalCriticalErrorState('#004')
    return
  }
  
  const selectedFileNameEl = document.querySelector('[data-sociata-selected-file-name]')
  if (!selectedFileNameEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-selected-file-name]')
    displayGlobalCriticalErrorState('#005')
    return
  }
  
  const fileIsTooBigMessageEl = document.querySelector('[data-sociata-file-is-too-big-message]')
  if (!fileIsTooBigMessageEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-file-is-too-big-message]')
    displayGlobalCriticalErrorState('#006')
    return
  }
  
  const submitButtonEl = document.querySelector('[data-sociata-submit-button]')
  if (!submitButtonEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-submit-button]')
    displayGlobalCriticalErrorState('#007')
    return
  }
  
  const loadingImageEl = document.querySelector('[data-sociata-loading-img]')
  if (!loadingImageEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-loading-img]')
    displayGlobalCriticalErrorState('#008')
    return
  }
  
  const loadingMessageEl = document.querySelector('[data-sociata-status-message-pending]')
  if (!loadingMessageEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-status-message-pending]')
    displayGlobalCriticalErrorState('#009')
    return
  }
  
  const errorMessageEl = document.querySelector('[data-sociata-status-message-error]')
  if (!errorMessageEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-status-message-error]')
    displayGlobalCriticalErrorState('#010')
    return
  }

  const errorCodeEl = document.querySelector('[data-sociata-error-code]')
  if (!errorCodeEl) {
    reportError('ERROR during initializing: cannot find [data-sociata-error-code]')
    displayGlobalCriticalErrorState('#011')
    return
  }

  // let retoolIframeEl // set it later. need to wait until Retool Iframe is added on the page

  // function setRetoolIframeEl() {
  //   retoolIframeEl = document.querySelector('iframe[src*="sociata.retool.com"]')
  //   if (retoolIframeEl) return
  //   reportError('ERROR in setRetoolIframeEl(): cannot find iframe[src*="sociata.retool.com"]')
  //   displayGlobalCriticalErrorState('#012')
  // }


  // model variables, should be in sync with what user types
  let theRawUsername = '' // entered by user in [data-sociata-username-input-element] (would be reactive variable in Vue)
  let theUsername = '' // same, but no '@' character and whitespaces are trimmed (would be computed property in Vue)

  const noFileSelectedPlaceholderText = 'No file selected'
  // model variables, should be in sync with what file user selects
  let theFile = null // currently selected file (would be reactive variable in Vue)
  let theFileName = null // (would be computed property in Vue)
  let theFileType = null // (would be computed property in Vue)
  let theFileSize = null // (would be computed property in Vue)
  let isFileTooBig = false // more than 1.25 Gb (would be computed property in Vue)

  // needed to defer calling askForSignedUrlDetails() in case Retool App is taking long time to load
  // let wasSubmitButtonClicked = false
  // true when 'retoolAppIsReady' message has been received AND retoolIframeEl is defined
  // let isRetoolAppReady = false
  
  
  // prepare the form to its first rendering
  
  // auto-insert previously saved username (*)
  usernameInputEl.value = loadPreviousUsername() || ''
  // hide loading image if not yet hidden
  loadingImageEl.removeAttribute('data-rendered')
  // hide loading message if not yet hidden
  loadingMessageEl.removeAttribute('data-rendered')
  // hide error messages if not yet hidden
  errorMessageEl.removeAttribute('data-rendered')
  fileIsTooBigMessageEl.removeAttribute('data-rendered')
  
  
  
  // set up event listeners
  usernameInputEl.addEventListener('input', (event) => {
    // update models
    theRawUsername = usernameInputEl.value
    theUsername = theRawUsername?.trim()?.replace('@', '')
    saveUsername()
    // update view
    renderSubmitButton()
    unsetErrorState()
  })
  // now manually trigger 'input' event. why?
  // because in (*) we manually set previously
  // entered username, but it doesn't trigger
  // 'input' event handler automatically
  usernameInputEl.dispatchEvent(new Event('input'))


  selectFileButtonEl.addEventListener('click', (event) => {
    // trigger manually because fileInputEl is not rendered (display: none)
    fileInputEl.click()
  })
  

  fileInputEl.addEventListener('change', (event) => {
    // update models
    theFile = fileInputEl.files?.[0]
    theFileName = theFile?.name
    theFileType = theFile?.type
    theFileSize = theFile?.size
    isFileTooBig = checkIsFileTooBig()
    // update view
    renderSelectedFileName()
    renderFileIsTooBigMessage()
    renderSubmitButton()
    unsetErrorState()
  })
  

  submitButtonEl.addEventListener('click', (event) => {
    wasSubmitButtonClicked = true
    // update view
    unsetErrorState()
    enterLoadingState()

    // if (!isRetoolAppReady) {
    //   // wait until Retool App loads,
    //   // then try again
    //   return
    // }
    askForSignedUrlDetails()
  })
  
  
  
  
  function checkIsFileTooBig() {
    if (!theFileSize) return false
    return theFileSize > 1024 * 1024 * 1024 * 1.25 /* 1.25 Gb */
  }

  // update view
  function renderSelectedFileName() {
    selectedFileNameEl.textContent = theFileName || noFileSelectedPlaceholderText
    if (!theFileName) {
      selectedFileNameEl.setAttribute('data-dimmed', true)
    } else {
      selectedFileNameEl.removeAttribute('data-dimmed')
    }
  }

  // update view
  function renderFileIsTooBigMessage() {
    if (isFileTooBig) {
      fileIsTooBigMessageEl.setAttribute('data-rendered', true)
    } else {
      fileIsTooBigMessageEl.removeAttribute('data-rendered')
    }
  }
 
  // update view
  function renderSubmitButton() {
    if (theFileName && theUsername && !isFileTooBig) {
      submitButtonEl.removeAttribute('disabled')
    } else {
      submitButtonEl.setAttribute('disabled', true)
    }
  }
  
  // update view
  function enterLoadingState() {
    loadingImageEl.setAttribute('data-rendered', true)
    loadingMessageEl.setAttribute('data-rendered', true)
    usernameInputEl.setAttribute('disabled', true)
    selectFileButtonEl.setAttribute('disabled', true)
    submitButtonEl.setAttribute('disabled', true)
  }
  function exitLoadingState() {
    loadingImageEl.removeAttribute('data-rendered')
    loadingMessageEl.removeAttribute('data-rendered')
    usernameInputEl.removeAttribute('disabled')
    selectFileButtonEl.removeAttribute('disabled')
    submitButtonEl.removeAttribute('disabled')
  }
  
  // update view
  function setErrorState(errorCode) {
    exitLoadingState()
    errorMessageEl.setAttribute('data-rendered', true)
    errorCodeEl.textContent = errorCode || ''
  }
  function unsetErrorState() {
    errorMessageEl.removeAttribute('data-rendered')
    errorCodeEl.textContent = ''
  }
  

  function loadPreviousUsername() {
    // we will have many pages like this in future,
    // so the localStorage key must be unique for each such page
    return localStorage.getItem(`sociata-social-marketing-content-uploader-${window.sociataFrameIoFolderAssetId}-saved-username`)
  }
  function saveUsername() {
    localStorage.setItem(`sociata-social-marketing-content-uploader-${window.sociataFrameIoFolderAssetId}-saved-username`, theRawUsername)
  }





  // now it's time to handle everything related to the Retool App
  
  // initialize Retool App
  // window.retool.RetoolDashboard(
  //   document.getElementById('sociata-retool-app-container'),
  //   'https://sociata.retool.com/embedded/public/ce07131c-cd0a-451d-aa94-dbade6ba4f08'
  // )

  // we can't wait infinitelly until Retool App loads, so
  // let's consider it's failed if it's not loaded withing 1 min
  // const maxWaitingTimeUntilRetoolAppIsReadyInMs = 1000 * 60 // 1 min
  // setTimeout(() => {
  //   if (isRetoolAppReady) return
  //   reportError(`ERROR while initializing Retool App: maximum waiting time of ${maxWaitingTimeUntilRetoolAppIsReadyInMs} is reached. Retool App is still not ready`)
  //   displayGlobalCriticalErrorState('#013')
  // }, maxWaitingTimeUntilRetoolAppIsReadyInMs)
  


  // set up communication channel with Retool App using postMessage protocol.
  // it works now, but its future reliability cannot be guaranteed, i think
  // window.addEventListener('message', async (event) => {
  //   if (event.origin !== 'https://sociata.retool.com') return

  //   log(`Received message from Retool App: ${JSON.stringify(event.data)}`, event)
    
  //   const eventObject = event.data
  //   const type = eventObject?.type

  //   switch (type) {
  //     case 'retoolAppIsReady': {
  //       handleRetoolAppIsReadyMessage()
  //       return
  //     }
  //     case 'signedUploadURLDetails': {
  //       handleSignedUploadUrlDetailsMessage(eventObject)
  //       return
  //     }
  //     case 'createdAssetId': {
  //       handleCreatedAssetIdMessage(eventObject)
  //       return
  //     }
  //   }
  // })

  // function handleRetoolAppIsReadyMessage() {
  //   setRetoolIframeEl()
  //   if (!retoolIframeEl) return // error is already handled in setRetoolIframeEl()
  //   isRetoolAppReady = true
  //   log('Retool App is ready')
  //   if (wasSubmitButtonClicked) {
  //     // this call was deferred
  //     // until Retool App is ready
  //     askForSignedUrlDetails()
  //   }
  // }

  function handleSignedUploadUrlDetailsMessage(eventObject) {
    const error = eventObject?.error
    const signedUrlDetails = eventObject?.data
    if (error) {
      reportError('ERROR in handleSignedUploadUrlDetailsMessage(): could not get signed upload URL details', error)
      setErrorState('#101')
      return
    }
    uploadFile(signedUrlDetails)
      .then(askToCreateNewAsset)
      .catch((e) => {
        reportError('ERROR in handleSignedUploadUrlDetailsMessage(): error in a chain of promises: uploadFile -> askToCreateNewAsset', e)
        // setErrorState('#102') // don't override actual error code (like #104). at this point error is already handled
        return
      })
  }

  function handleCreatedAssetIdMessage(eventObject) {
    const error = eventObject?.error
    const assetId = eventObject?.data
    if (error || !assetId) {
      reportError('ERROR in handleCreatedAssetIdMessage(): could not get created asset Id', error)
      setErrorState('#103')
      return
    }
    log('Finished successfully! New asset Id: ', assetId)
    wrapUpSuccessfully()
  }
  
  

  function askForSignedUrlDetails() {
    if (!theFileName) {
      reportError('ERROR in askForSignedUrlDetails(): theFileName is not defined')
      displayGlobalCriticalErrorState('#014')
      return
    }
    sendMessageToRetoolApp({ type: 'getSignedUploadURL', fileName: theFileName })
  }

  function askToCreateNewAsset({ fileName, fileType, sourceUrl }) {
    const assetId = window.sociataFrameIoFolderAssetId // set up globally in Webflow's custom code block
    if (!fileName || !fileType || !sourceUrl || !assetId) {
      reportError(`ERROR in askToCreateNewAsset(): one or more params are missing: ${JSON.stringify({ fileName, fileType, sourceUrl, assetId })}`)
      displayGlobalCriticalErrorState('#015')
      return
    }
    sendMessageToRetoolApp({ type: 'createAsset', fileName, fileType, sourceUrl, assetId })
  }

  // function sendMessageToRetoolApp(eventObject) {
  //   if (!retoolIframeEl) {
  //     reportError('ERROR in sendMessageToRetoolApp(): retoolIframeEl is not defined')
  //     displayGlobalCriticalErrorState('#016')
  //     return
  //   }
  //   try {
  //     // WARNING! undocumented feature, i have found it accidentally.
  //     // cannot be considered reliable by any means. will probably break in future
  //     retoolIframeEl.contentWindow[1].postMessage(eventObject, '*')
  //   } catch (e) {
  //     reportError(`ERROR in sendMessageToRetoolApp(): cannot postMessage to Retool iFrame with the following event object: ${JSON.stringify(eventObject)}`)
  //     displayGlobalCriticalErrorState('#017')
  //     return
  //   }
  // }

  function sendMessageToRetoolApp(eventObject) {
    if (eventObject.type === 'getSignedUploadURL') {
      const { fileName } = eventObject
      const fileNameBase64Encoded = btoa(fileName) // looks like BE doesn't like spaces in the filename
      fetch(`https://europe-west3-trellis-production.cloudfunctions.net/get-upload-url?filename=${fileNameBase64Encoded}`, {
        "method": "GET",
        "mode": "cors",
      })
        .then(res => res.json())
        .then(json => handleSignedUploadUrlDetailsMessage({ error: null, data: json.data }))
        .catch(err => handleSignedUploadUrlDetailsMessage({ error: err, data: null }))
      return
    }

    if (eventObject.type === 'createAsset') {
      const { fileName, fileType, sourceUrl, assetId } = eventObject

      fetch(" https://europe-west3-trellis-production.cloudfunctions.net/create-frame-io-asset", {
        "body": JSON.stringify({
          body: {
            name: fileName,
            type: 'file',
            filetype: fileType,
            source: {
              url: sourceUrl,
            },
          },
          asset_id: assetId, // parent folder id
        }),
        "method": "POST",
        "mode": "cors",
      })
        .then(res => res.json())
        .then(json => handleCreatedAssetIdMessage({ error: null, data: json.id }))
        .catch(err => handleCreatedAssetIdMessage({ error: err, data: null }))
      return
    }
  }


  
  
  
  async function uploadFile(signedUrlDetails) {
    if (!theFile) {
      reportError('ERROR in uploadFile(): theFile is not defined')
      setErrorState('#104')
      return
    }

    if (!theFileName) {
      reportError('ERROR in uploadFile(): theFileName is not defined')
      setErrorState('#105')
      return
    }

    if (!theFileType) {
      reportError('ERROR in uploadFile(): theFileType is not defined')
      setErrorState('#106')
      return
    }

    if (!theUsername) {
      reportError('ERROR in uploadFile(): theUsername is not defined')
      setErrorState('#107')
      return
    }
    
    let fileType = theFileType
    if (fileType === 'video/avi') {
      // Chrome recognizes .avi as video/avi,
      // but better to use the following mimetype,
      // otherwise BE is unhappy
      fileType = 'video/x-msvideo'
    }

    const base64EncodedFinalUrl = signedUrlDetails?.url
    const formUrl = signedUrlDetails?.upload?.url
    const formFields = signedUrlDetails?.upload?.fields
    log('formFields', formFields)
    
    if (!base64EncodedFinalUrl) {
    	reportError('ERROR in uploadFile(): base64EncodedFinalUrl is not defined')
      setErrorState('#108')
      return
    }
    
    if (!formUrl) {
    	reportError('ERROR in uploadFile(): formUrl is not defined')
      setErrorState('#109')
      return
    }
    
    if (!formFields || !formFields?.key) {
    	reportError('ERROR in uploadFile(): formFields are not defined or incorrect')
      setErrorState('#110')
      return
    }

    let formData
    try {
      formData = new FormData()
      for (const name of Object.keys(formFields)) {
        const value = formFields[name]
        formData.append(name, value)
      }
      formData.append('acl', 'public-read')
      formData.append('Content-Type', fileType)
      formData.append('file', theFile, `${theUsername}_${theFileName}`)
      // one of the fields is policy document - it's important to know what it is.
      // see https://cloud.google.com/storage/docs/authentication/signatures#policy-document
    } catch (e) {
      reportError('ERROR in uploadFile(): Could not construct FormData')
      setErrorState('#111')
      return
    }
    log('FormData', [...formData])

    // IMPORTANT:
    // this can fail due to CORS (especially locally)
    // as CORS are configured to only
    // allow requests from specific origins.
    // Kinane can update a list of allowed origins,
    // so, if needed, ask him.
    // https://cloud.google.com/storage/docs/cross-origin
    try {
      // what's going on here is described in the following documentation:
      // https://cloud.google.com/storage/docs/xml-api/post-object-forms
      const postFormResponse = await fetch(formUrl, { method: 'POST', body: formData })
      const postFormResponseText = await postFormResponse.text()
      // in case of error, this variable will hold error message in XML format
      // in case of success, it will be empty ('')
      log('postFormResponseText', postFormResponseText)
      const statusCode = postFormResponse.status
      const statusCodeString = `${statusCode}`
      const isResponseSuccessful = statusCodeString.startsWith('2') || statusCodeString.startsWith('3')
      // native fetch() doesn't throw unless it cannot receive an actual response.
      // even 404 response with no body will not throw. we must check status code
      // manully and then throw manually if its not 2xx or 3xx. this is different with how axios behaves
      if (!isResponseSuccessful) throw new Error(`HTTP status code is ${statusCodeString}. Response text is "${postFormResponseText}"`)
    } catch (e) {
      reportError('ERROR in uploadFile(): Could not upload file using signed URL (POST request)', e)
      setErrorState('#112')
      return
    }

    let finalExternalFileUrl
    try {
      finalExternalFileUrl = atob(base64EncodedFinalUrl)
    } catch (e) {
      reportError('ERROR in uploadFile(): Could not decode base64EncodedFinalUrl', e)
      setErrorState('#113')
      return
    }

    const fileNameForFrameIO = theUsername // Rim asked to make file names same as usernames in FrameIO
    // so if user enters '@kitty' as username and uploads file named 'CAM_01_fullHD.mov', it must
    // appear as 'kitty.mov' in Frame.IO. what about the subsequent files from the same user?
    // don't worry, Frame.IO allows assets with same name, there will be many 'kitty.mov's
    const fileTypeForFrameIO = fileType
    const fileUrlForFrameIO = finalExternalFileUrl

    return ({
      fileName: fileNameForFrameIO,
      fileType: fileTypeForFrameIO,
      sourceUrl: fileUrlForFrameIO,
    })
  }
  
  
  


  // time to finish
  function wrapUpSuccessfully() {
    showPopup('success')
    // reset the form
    exitLoadingState()
    unsetErrorState() // is this line really needed?
    fileInputEl.value = null // this will not trigger onChange event handler
    // so let's do it manually
    fileInputEl.dispatchEvent(new Event('change'))
  }



  // update view
  function showPopup(type) {
    let popup
    if (type === 'success') {
      popup = document.querySelector('[data-sociata-retool-success-dialog]')
    } else if (type === 'fail') {
      // not defined
    }
    if (!popup) return
    popup?.setAttribute('data-hidden', false)
    window.addEventListener('click', onClickAnywhere)
  }

  function onClickAnywhere() {
    closePopups()
  }

  function closePopups() {
    successPopup = document.querySelector('[data-sociata-retool-success-dialog]')
    successPopup?.setAttribute('data-hidden', 'true')
    window.removeEventListener('click', onClickAnywhere)
  }
})();

