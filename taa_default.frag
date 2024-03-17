#version 450

layout(constant_id) const int WINDOW_R = 1;

layout(location = 0) out vec4 color;

layout(location = 0) in vec2 texCoord;

layout(binding = 0) uniform sampler2D colorTex;

layout(push_constant) uniform params_t
{
    vec2 offset;
    float gamma;
    float t;
} params;

vec3 rgb2ycbcr(vec3 rgb) 
{   
    vec3 ycbcr;
    ycbcr.x = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
    ycbcr.y = -0.1146 * rgb.r - 0.3854 * rgb.g + 0.5 * rgb.b;
    ycbcr.z = 0.5 * rgb.r - 0.4542 * rgb.g - 0.0458 * rgb.b;
    return ycbcr;
}

vec3 ycbcr2rgb(vec3 ycbcr) 
{
    vec3 rgb;
    rgb.x = ycbcr.x + 1.5748 * ycbcr.z;
    rgb.y = ycbcr.x - 0.1873 * ycbcr.y - 0.4681 * ycbcr.z;
    rgb.z = ycbcr.x + 1.8556 * ycbcr.y;
    return rgb;
}

void main() 
{
    vec3 mean = vec3(0);
    vec3 sigma = vec3(0);

    for (int i = -WINDOW_R; i <= WINDOW_R; ++i)
    {
        for (int j = -WINDOW_R; j <= WINDOW_R; ++j)
        {
            vec3 c = rgb2ycbcr(textureLod(currenFrame, texCoord + vec2(j, i) * params.offset, 0).rgb);
            mean += c;
            sigma += c * c;
        }
    }

    const float d = (2 * WINDOW_R + 1) * (2 * WINDOW_R + 1);
    mean /= d;
    sigma = sqrt(sigma / d - mean * mean);

    vec3 minC = mean - params.gamma * sigma;
    vec3 maxC = mean + params.gamma * sigma;

    color = vec4(ycbcr2rgb(mix(minC, maxC, params.t)), 1.0);
}