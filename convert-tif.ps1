Add-Type -AssemblyName System.Drawing
$in = "C:\Users\evgen\Documents\Codex\2026-04-23-use-my-pc-and-crome-to\site-assets\content\media\pages\contact.tif"
$out = "C:\Users\evgen\Documents\Codex\2026-04-23-use-my-pc-and-crome-to\site-assets\content\media\pages\contact.jpg"
$img = [System.Drawing.Image]::FromFile($in)
$img.Save($out, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$img.Dispose()
