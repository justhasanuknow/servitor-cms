# Media

Images live in the media library under **Content → Media**. Every user has their own library; images are used in post content, as cover images, as social sharing images and as profile pictures.

## Uploading

Choose **Upload image**, pick a file and choose **Upload**. You can also upload directly from the image picker of the editor.

| Limit       | Value                                         |
| ----------- | --------------------------------------------- |
| Formats     | JPEG, PNG, WebP, GIF (also animated) and AVIF |
| File size   | 10 MB                                         |
| Image size  | 40 megapixels                                 |
| Upload rate | 30 uploads per minute and user                |

The format is recognised from the content of the file, never from its name or the type your browser reports. SVG and every other format are refused.

Each upload is decoded and re-encoded into WebP images of 480, 960 and 1600 pixels width plus the original size. Metadata such as EXIF data and GPS coordinates is removed, and the original file is not kept. Readers' browsers pick the size that fits their screen.

## Alternative texts

Alternative text describes an image for people who cannot see it and for search engines. Choose **Alt text** on an image to write one per enabled content language, so that each translation of a post shows the description in its own language. The editor also asks for an alt text when you insert an image.

## Using images

- **In the content**: the **Image** block opens the media library; choose **Insert this image**.
- **As cover image**: in the **Post settings** of a post.
- **As social sharing image**: in the **Search and sharing** fields of a translation.
- **As profile picture**: under **My account → Profile**; the picture is cropped to a square.

You can only use images from your own library. This keeps authors from publishing somebody else's pictures by accident.

## Deleting

**Delete** removes an image and all of its sizes permanently. Images that are used by a post revision, as a cover, as a sharing image or as a profile picture are marked **In use** and cannot be deleted. Deleting a post leaves its images in the library.

## Privacy of image addresses

Images are served from addresses such as `/media/<id>/960.webp`. The IDs are long random values, so nobody can guess them, but the addresses are public: anyone who has the link can open an image, even one that is only used in an unpublished draft. Do not upload images that must stay private.

Images are sent with a long cache lifetime, a fixed content type and a restrictive Content Security Policy, so a browser never treats them as anything but an image.
