$log = "$env:TEMP\spinepay-speech.log"
Set-Content $log "$(Get-Date) - Script started"

try {
    Add-Type -AssemblyName System.Speech
    Add-Content $log "$(Get-Date) - Assembly loaded"

    $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    Add-Content $log "$(Get-Date) - Engine created"

    $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    Add-Content $log "$(Get-Date) - Grammar loaded"

    $rec.SetInputToDefaultAudioDevice()
    Add-Content $log "$(Get-Date) - Audio device set"

    $rec.add_SpeechRecognized({
        param($s, $e)
        $t = $e.Result.Text
        Add-Content $log "$(Get-Date) - Recognized: $t"
        Write-Host "RESULT:$t"
        [Console]::Out.Flush()
    })

    $rec.add_SpeechRecognitionRejected({
        Add-Content $log "$(Get-Date) - Rejected (low confidence)"
    })

    $rec.add_SpeechDetected({
        Add-Content $log "$(Get-Date) - Speech detected"
    })

    $rec.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
    Add-Content $log "$(Get-Date) - RecognizeAsync started, entering loop"

    while ($true) {
        Start-Sleep -Milliseconds 500
    }

} catch {
    Add-Content $log "$(Get-Date) - ERROR: $_"
    Write-Host "ERROR:$_"
    [Console]::Out.Flush()
}
