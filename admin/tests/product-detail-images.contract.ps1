$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$component = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root "src/components/ImageGridUpload.vue")
$products = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root "src/views/products/index.vue")

function Assert-Marker([string]$source, [string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker $component 'multiple?: boolean' 'ImageGridUpload must expose an optional multiple prop'
Assert-Marker $component 'displayLimit?: number' 'ImageGridUpload must expose an optional displayLimit prop'
Assert-Marker $component ':multiple="multiple"' 'ImageGridUpload must forward multiple selection to el-upload'
Assert-Marker $component 'previewImages' 'ImageGridUpload must provide a complete preview image list'
Assert-Marker $component '+{{' 'ImageGridUpload must render a collapsed count entry'
Assert-Marker $component "thumbnailMode?: 'square' | 'long'" 'ImageGridUpload must expose a long-thumbnail mode'
Assert-Marker $component 'image-preview--long' 'ImageGridUpload must style long thumbnails separately'

Assert-Marker $products 'isDetailImage && form[field].length + detailUploadCount.value >= 15' 'detailImages upload limit must include pending uploads'
Assert-Marker $products ':max="15"' 'detailImages uploader must allow at most 15 images'
Assert-Marker $products ':multiple="true"' 'detailImages uploader must allow selecting multiple files'
Assert-Marker $products ':display-limit="3"' 'detailImages uploader must collapse after 3 previews'
Assert-Marker $products 'thumbnail-mode="long"' 'detailImages uploader must use the long-thumbnail mode'

if ($products.IndexOf('field === ''images'' || field === ''detailImages''', [StringComparison]::Ordinal) -ge 0) {
  throw 'images and detailImages must not share the same upload limit condition'
}

Write-Output "product detail images contract: PASS"
