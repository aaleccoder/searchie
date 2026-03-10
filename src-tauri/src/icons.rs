/// Extracts the first large icon from a Windows executable or icon file and
/// encodes it as a PNG byte vector.  Returns `None` when extraction fails or
/// on non-Windows platforms.
#[cfg(target_os = "windows")]
pub fn extract_icon_png(path: &str) -> Option<Vec<u8>> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    use winapi::shared::windef::HICON;
    use winapi::um::shellapi::ExtractIconExW;
    use winapi::um::winuser::DestroyIcon;

    let wide: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut large_icon: HICON = ptr::null_mut();
    let extracted = unsafe {
        ExtractIconExW(wide.as_ptr(), 0, &mut large_icon, ptr::null_mut(), 1)
    };

    if extracted == 0 || large_icon.is_null() {
        return None;
    }

    let result = hicon_to_png(large_icon);
    unsafe { DestroyIcon(large_icon) };
    result
}

#[cfg(target_os = "windows")]
fn hicon_to_png(hicon: winapi::shared::windef::HICON) -> Option<Vec<u8>> {
    use std::ptr;
    use winapi::shared::minwindef::LPVOID;
    use winapi::um::wingdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use winapi::um::winuser::{GetDC, GetIconInfo, ReleaseDC, ICONINFO};

    let (pixels, w, h): (Vec<u8>, u32, u32) = unsafe {
        let mut icon_info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            return None;
        }

        if icon_info.hbmColor.is_null() {
            if !icon_info.hbmMask.is_null() {
                DeleteObject(icon_info.hbmMask as LPVOID);
            }
            return None;
        }

        let hdc_screen = GetDC(ptr::null_mut());
        let hdc = CreateCompatibleDC(hdc_screen);
        ReleaseDC(ptr::null_mut(), hdc_screen);

        let mut bm: BITMAP = std::mem::zeroed();
        GetObjectW(
            icon_info.hbmColor as LPVOID,
            std::mem::size_of::<BITMAP>() as i32,
            &mut bm as *mut BITMAP as LPVOID,
        );

        let w = bm.bmWidth as u32;
        let h = bm.bmHeight.unsigned_abs();

        if w == 0 || h == 0 {
            DeleteDC(hdc);
            DeleteObject(icon_info.hbmColor as LPVOID);
            DeleteObject(icon_info.hbmMask as LPVOID);
            return None;
        }

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = w as i32;
        bmi.bmiHeader.biHeight = -(h as i32); // top-down DIB
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut pixels = vec![0u8; (w * h * 4) as usize];
        let copied = GetDIBits(
            hdc,
            icon_info.hbmColor,
            0,
            h,
            pixels.as_mut_ptr() as LPVOID,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        DeleteDC(hdc);
        DeleteObject(icon_info.hbmColor as LPVOID);
        DeleteObject(icon_info.hbmMask as LPVOID);

        if copied == 0 {
            return None;
        }

        // Windows stores bitmap pixels as BGRA; PNG expects RGBA.
        for chunk in pixels.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        Some((pixels, w, h))
    }?;

    encode_rgba_as_png(&pixels, w, h)
}

#[cfg(target_os = "windows")]
fn encode_rgba_as_png(pixels: &[u8], w: u32, h: u32) -> Option<Vec<u8>> {
    let mut buf = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut buf, w, h);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        let mut writer = enc.write_header().ok()?;
        writer.write_image_data(pixels).ok()?;
    }
    Some(buf)
}

#[cfg(not(target_os = "windows"))]
pub fn extract_icon_png(_path: &str) -> Option<Vec<u8>> {
    None
}
